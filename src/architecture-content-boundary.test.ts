// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Independent static gates for Phase 1 / 20 / 21.
 *
 * This file deliberately imports no Desktop product module.  It parses the
 * implementation source and follows a small conservative taint lattice:
 * editor/storage representations are tainted, while the canonical content
 * projectors are the only sanitizing boundary.  The goal is to catch a new
 * bypass even when the raw value is first assigned to an innocently named
 * local variable.
 */

const SRC_ROOT = dirname(fileURLToPath(import.meta.url))
const DESKTOP_ROOT = join(SRC_ROOT, '..')
const SOURCE_FILE = /\.(?:ts|tsx)$/
const TEST_FILE = /(?:\.test|\.spec)\.(?:ts|tsx)$/

const CANONICAL_PROJECTORS = new Set([
  'projectContent',
  'projectEditorContent',
  'semanticDocumentFromHtml',
  'semanticDocumentFromProseMirror',
  'semanticDocumentFromText',
  'semanticTextFromContent',
])

const AI_BOUNDARY_ARGUMENTS = new Map<string, number>([
  ['createAssistantTask', 0],
  ['createContinueTask', 0],
  ['createContinuityAuditTask', 0],
  ['createDeepReasoningTask', 0],
  ['createDistillationTask', 0],
  ['createPluginAnalysisTask', 0],
  ['createRewriteTask', 0],
  ['onAiTask', 0],
  ['runAiTask', 0],
  ['runContinuityAudit', 0],
  ['runDeepReasoning', 0],
  ['runDistillationWorkflow', 0],
  ['runPluginTask', 1],
  ['runPluginTool', 1],
  ['runPluginWorkflow', 1],
  ['runTask', 0],
])

const DIRECT_MODEL_METHODS = new Set([
  'complete',
  'createChatCompletion',
  'createCompletion',
  'generateObject',
  'generateText',
  'getProvider',
  'streamAi',
  'streamObject',
  'streamText',
])

const LEGACY_IDENTIFIERS = new Set([
  'onAiPrompt',
  'openSession',
  'suggestContinuation',
  'systemPromptEnhancer',
])

const COMPONENT_PROMPT_VARIABLES = new Set([
  'instruction',
  'prompt',
  'promptText',
  'systemPrompt',
  'userPrompt',
])

const RAW_REPRESENTATION_IDENTIFIERS = new Set([
  'editorHtml',
  'html',
  'htmlContent',
  'rawContent',
  'rawHtml',
  'storedHtml',
])

interface ParsedSource {
  relativeFile: string
  ast: ts.SourceFile
}

interface TaintEnvironment {
  parent?: TaintEnvironment
  values: Map<string, boolean>
}

interface BoundaryAudit {
  boundaryCalls: number
  violations: string[]
}

function walk(root: string): string[] {
  const files: string[] = []
  for (const name of readdirSync(root)) {
    if (name === 'node_modules' || name === '.git') continue
    const file = join(root, name)
    if (statSync(file).isDirectory()) {
      files.push(...walk(file))
    } else if (SOURCE_FILE.test(name) && !TEST_FILE.test(name) && !name.endsWith('.d.ts')) {
      files.push(file)
    }
  }
  return files
}

function implementationSources(root = SRC_ROOT): ParsedSource[] {
  return walk(root).map((file) => {
    const source = readFileSync(file, 'utf8')
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    return {
      relativeFile: relative(DESKTOP_ROOT, file).split(/[\\/]/).join('/'),
      ast: ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind),
    }
  })
}

function parseFixture(source: string, relativeFile = 'fixture.ts'): ParsedSource {
  const scriptKind = relativeFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return {
    relativeFile,
    ast: ts.createSourceFile(relativeFile, source, ts.ScriptTarget.Latest, true, scriptKind),
  }
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  )
}

function functionName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const argument = expression.argumentExpression
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return argument.text
    }
  }
  return undefined
}

function propertyChain(expression: ts.Expression): string[] {
  if (ts.isIdentifier(expression)) return [expression.text]
  if (ts.isPropertyAccessExpression(expression)) {
    return [...propertyChain(expression.expression), expression.name.text]
  }
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const argument = expression.argumentExpression
    if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
      return [...propertyChain(expression.expression), argument.text]
    }
  }
  return []
}

function newEnvironment(parent?: TaintEnvironment): TaintEnvironment {
  return { parent, values: new Map() }
}

function lookup(environment: TaintEnvironment, name: string): boolean {
  if (environment.values.has(name)) return environment.values.get(name) === true
  return environment.parent ? lookup(environment.parent, name) : false
}

function setLocal(environment: TaintEnvironment, name: string, value: boolean): void {
  environment.values.set(name, value)
}

function isCanonicalProjectorCall(node: ts.CallExpression): boolean {
  return CANONICAL_PROJECTORS.has(functionName(node.expression) || '')
}

function isUnsafeEditorCall(node: ts.CallExpression): boolean {
  const name = functionName(node.expression)
  return name === 'getHTML' || name === 'getJSON' || name === 'toJSON' || name === 'parseFromString'
}

function isTaintedExpression(
  node: ts.Expression | undefined,
  environment: TaintEnvironment,
): boolean {
  if (!node) return false

  if (ts.isParenthesizedExpression(node)) return isTaintedExpression(node.expression, environment)
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
    return isTaintedExpression(node.expression, environment)
  }
  if (ts.isNonNullExpression(node)) return isTaintedExpression(node.expression, environment)
  if (ts.isSatisfiesExpression(node)) return isTaintedExpression(node.expression, environment)
  if (ts.isAwaitExpression(node)) return isTaintedExpression(node.expression, environment)

  if (ts.isIdentifier(node)) {
    return lookup(environment, node.text) || RAW_REPRESENTATION_IDENTIFIERS.has(node.text)
  }

  if (ts.isPropertyAccessExpression(node)) {
    const property = node.name.text
    if (property === 'content' || property === 'innerHTML' || property === 'outerHTML') return true
    return isTaintedExpression(node.expression, environment)
  }

  if (ts.isElementAccessExpression(node)) {
    const property = node.argumentExpression
    if (
      property &&
      (ts.isStringLiteral(property) || ts.isNoSubstitutionTemplateLiteral(property)) &&
      property.text === 'content'
    ) {
      return true
    }
    return (
      isTaintedExpression(node.expression, environment) ||
      isTaintedExpression(property, environment)
    )
  }

  if (ts.isCallExpression(node)) {
    if (isCanonicalProjectorCall(node)) return false
    if (isUnsafeEditorCall(node)) return true
    return node.arguments.some((argument) => {
      if (ts.isSpreadElement(argument)) return isTaintedExpression(argument.expression, environment)
      return isTaintedExpression(argument, environment)
    })
  }

  if (ts.isNewExpression(node)) {
    if (functionName(node.expression) === 'DOMParser') return true
    return (node.arguments || []).some((argument) => isTaintedExpression(argument, environment))
  }

  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return isTaintedExpression(property.expression, environment)
      }
      if (ts.isPropertyAssignment(property)) {
        return isTaintedExpression(property.initializer, environment)
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        return lookup(environment, property.name.text)
      }
      if (ts.isMethodDeclaration(property)) {
        return functionReturnTaint(property, environment)
      }
      return false
    })
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.some((element) => {
      if (ts.isSpreadElement(element)) return isTaintedExpression(element.expression, environment)
      return isTaintedExpression(element, environment)
    })
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return functionReturnTaint(node, environment)
  }

  if (ts.isConditionalExpression(node)) {
    return (
      isTaintedExpression(node.condition, environment) ||
      isTaintedExpression(node.whenTrue, environment) ||
      isTaintedExpression(node.whenFalse, environment)
    )
  }

  if (ts.isBinaryExpression(node)) {
    return (
      isTaintedExpression(node.left, environment) || isTaintedExpression(node.right, environment)
    )
  }

  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) {
    return isTaintedExpression(node.operand, environment)
  }

  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.some((span) => isTaintedExpression(span.expression, environment))
  }

  return false
}

function bindParameters(
  parameters: readonly ts.ParameterDeclaration[],
  environment: TaintEnvironment,
): void {
  for (const parameter of parameters) {
    if (ts.isIdentifier(parameter.name)) setLocal(environment, parameter.name.text, false)
  }
}

function functionReturnTaint(node: ts.FunctionLikeDeclaration, parent: TaintEnvironment): boolean {
  const environment = newEnvironment(parent)
  bindParameters(node.parameters, environment)

  if (!node.body) return false
  if (!ts.isBlock(node.body)) return isTaintedExpression(node.body, environment)

  let taintedReturn = false
  for (const statement of node.body.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        bindVariable(declaration, environment)
      }
    } else if (ts.isExpressionStatement(statement)) {
      bindAssignment(statement.expression, environment)
    } else if (ts.isReturnStatement(statement)) {
      taintedReturn ||= isTaintedExpression(statement.expression, environment)
    } else if (ts.isIfStatement(statement)) {
      taintedReturn ||= taintReturnedExpressions(statement.thenStatement, environment)
      if (statement.elseStatement) {
        taintedReturn ||= taintReturnedExpressions(statement.elseStatement, environment)
      }
    }
  }
  return taintedReturn
}

function taintReturnedExpressions(node: ts.Node, parent: TaintEnvironment): boolean {
  if (ts.isReturnStatement(node)) return isTaintedExpression(node.expression, parent)
  if (ts.isBlock(node)) {
    const functionLike = {
      parameters: [] as readonly ts.ParameterDeclaration[],
      body: node,
    } as unknown as ts.FunctionLikeDeclaration
    return functionReturnTaint(functionLike, parent)
  }
  return false
}

function bindVariable(declaration: ts.VariableDeclaration, environment: TaintEnvironment): void {
  if (!ts.isIdentifier(declaration.name)) return
  setLocal(
    environment,
    declaration.name.text,
    isTaintedExpression(declaration.initializer, environment),
  )
}

function bindAssignment(node: ts.Expression, environment: TaintEnvironment): void {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return
  if (ts.isIdentifier(node.left)) {
    setLocal(environment, node.left.text, isTaintedExpression(node.right, environment))
  }
}

function auditTaintedBoundaries(parsed: ParsedSource): BoundaryAudit {
  const violations: string[] = []
  let boundaryCalls = 0
  const rootEnvironment = newEnvironment()

  const report = (node: ts.CallExpression, boundary: string, argumentIndex: number): void => {
    boundaryCalls += 1
    const argument = node.arguments[argumentIndex]
    if (!argument) return
    const expression = ts.isSpreadElement(argument) ? argument.expression : argument
    if (isTaintedExpression(expression, currentEnvironment)) {
      const line = parsed.ast.getLineAndCharacterOfPosition(node.getStart(parsed.ast)).line + 1
      violations.push(
        `${parsed.relativeFile}:${line} ${boundary} receives raw editor/chapter representation`,
      )
    }
  }

  let currentEnvironment = rootEnvironment
  const visit = (node: ts.Node, environment: TaintEnvironment): void => {
    const previousEnvironment = currentEnvironment
    currentEnvironment = environment

    if (isFunctionLike(node)) {
      const functionEnvironment = newEnvironment(environment)
      bindParameters(node.parameters, functionEnvironment)
      if (node.body) visit(node.body, functionEnvironment)
      currentEnvironment = previousEnvironment
      return
    }

    if (ts.isVariableDeclaration(node)) {
      bindVariable(node, environment)
      if (node.initializer) visit(node.initializer, environment)
      currentEnvironment = previousEnvironment
      return
    }

    if (ts.isExpressionStatement(node)) {
      bindAssignment(node.expression, environment)
    }

    if (ts.isCallExpression(node)) {
      const boundary = functionName(node.expression)
      const argumentIndex = boundary ? AI_BOUNDARY_ARGUMENTS.get(boundary) : undefined
      if (argumentIndex !== undefined) report(node, boundary, argumentIndex)
    }

    ts.forEachChild(node, (child) => visit(child, environment))
    currentEnvironment = previousEnvironment
  }

  visit(parsed.ast, rootEnvironment)
  return { boundaryCalls, violations }
}

function containsForbiddenCall(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(child)) {
      const name = functionName(child.expression)
      if (
        name &&
        (AI_BOUNDARY_ARGUMENTS.has(name) || DIRECT_MODEL_METHODS.has(name) || name === 'prompt')
      ) {
        found = true
        return
      }
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function isProviderModule(value: string): boolean {
  const normalized = value.toLowerCase()
  return (
    normalized === '@inkpi/ai' ||
    normalized.startsWith('@ai-sdk/') ||
    normalized.startsWith('@anthropic-ai/') ||
    normalized.startsWith('@google/') ||
    normalized.startsWith('@mistralai/') ||
    /^(?:ai|anthropic|deepseek|mistral|ollama|openai)(?:\/|$)/.test(normalized)
  )
}

function isTaskRpcMethod(value: string): boolean {
  return /^(?:agent|instruction|session|task)\.[a-z][\w.-]*$/i.test(value)
}

function auditLegacyPaths(parsed: ParsedSource): string[] {
  const violations = new Set<string>()
  const isComponent =
    parsed.relativeFile.startsWith('src/components/') ||
    (parsed.relativeFile.includes('/plugins/') && parsed.relativeFile.includes('/components/'))

  const report = (node: ts.Node, reason: string): void => {
    const line = parsed.ast.getLineAndCharacterOfPosition(node.getStart(parsed.ast)).line + 1
    violations.add(`${parsed.relativeFile}:${line} ${reason}`)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && LEGACY_IDENTIFIERS.has(node.text)) {
      report(node, `legacy AI identifier '${node.text}'`)
    }

    if (ts.isVariableDeclaration(node) && isComponent && ts.isIdentifier(node.name)) {
      if (COMPONENT_PROMPT_VARIABLES.has(node.name.text)) {
        report(node.name, `component-level prompt variable '${node.name.text}'`)
      }
    }

    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (isProviderModule(node.moduleSpecifier.text)) report(node, 'direct LLM provider import')
    }

    if (ts.isCallExpression(node)) {
      const name = functionName(node.expression)
      const chain = propertyChain(node.expression)
      if (name === 'prompt') report(node, 'direct AI prompt call')
      if (name && DIRECT_MODEL_METHODS.has(name)) report(node, `direct model call '${name}'`)
      if (
        name === 'create' &&
        ((chain.includes('chat') && chain.includes('completions')) ||
          (chain.includes('responses') && chain.includes('create')))
      ) {
        report(node, 'direct provider model call')
      }
      if (chain[0] === 'session' || chain[0] === 'agent') {
        report(node, `legacy session/agent interface '${chain.join('.')}'`)
      }

      const firstArgument = node.arguments[0]
      if (
        name === 'request' &&
        firstArgument &&
        ts.isStringLiteral(firstArgument) &&
        isTaskRpcMethod(firstArgument.text) &&
        !parsed.relativeFile.startsWith('src/adapters/')
      ) {
        report(node, `raw task/session RPC '${firstArgument.text}'`)
      }

      if (name === 'setTimeout' && node.arguments[0] && containsForbiddenCall(node.arguments[0])) {
        report(node, 'setTimeout wraps an AI boundary')
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(parsed.ast)
  return [...violations].sort()
}

function collectCalls(
  ast: ts.SourceFile,
  predicate: (node: ts.CallExpression) => boolean,
): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && predicate(node)) calls.push(node)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return calls
}

function variableInitializer(ast: ts.SourceFile, name: string): ts.Expression | undefined {
  let initializer: ts.Expression | undefined
  const visit = (node: ts.Node): void => {
    if (initializer) return
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      initializer = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return initializer
}

function jsxPropExpressions(ast: ts.SourceFile, propName: string): string[] {
  const expressions: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.text === propName) {
      const initializer = node.initializer
      if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
        expressions.push(initializer.expression.getText(ast).trim())
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return expressions
}

function hasJsxAttributeOnComponent(
  ast: ts.SourceFile,
  componentName: string,
  attributeName: string,
  expectedExpression: string,
): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      if (opening.tagName.getText(ast) === componentName) {
        const attribute = opening.attributes.properties.find(
          (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) && property.name.text === attributeName,
        )
        if (
          attribute?.initializer &&
          ts.isJsxExpression(attribute.initializer) &&
          attribute.initializer.expression?.getText(ast).trim() === expectedExpression
        ) {
          found = true
          return
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

function hasProjectorCall(expression: ts.Expression | undefined): boolean {
  if (!expression) return false
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(node) && isCanonicalProjectorCall(node)) {
      found = true
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(expression)
  return found
}

function hasNamedImport(ast: ts.SourceFile, name: string, moduleSuffix: string): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.endsWith(moduleSuffix)
    ) {
      const namedBindings = node.importClause?.namedBindings
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        found = namedBindings.elements.some((element) => element.name.text === name)
        if (found) return
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return found
}

describe('Phase 1/20/21 Desktop AI content-boundary architecture gates', () => {
  const sources = implementationSources()

  it('projects both central editor entry points before dispatching drawer/sidebar text', () => {
    const writer = sources.find(
      (source) => source.relativeFile === 'src/components/editor/WriterDesk.tsx',
    )
    const rich = sources.find(
      (source) => source.relativeFile === 'src/components/editor/RichEditor.tsx',
    )
    expect(writer).toBeDefined()
    expect(rich).toBeDefined()

    for (const source of [writer!, rich!]) {
      expect(hasNamedImport(source.ast, 'semanticTextFromContent', '/domain/content')).toBe(true)
      expect(hasProjectorCall(variableInitializer(source.ast, 'activeChapterText'))).toBe(true)
      expect(jsxPropExpressions(source.ast, 'currentText')).not.toContain('activeChapter?.content')
      expect(jsxPropExpressions(source.ast, 'currentText')).not.toContain('activeChapter.content')
      expect(
        jsxPropExpressions(source.ast, 'currentText').every(
          (value) => value === 'activeChapterText',
        ),
      ).toBe(true)
    }

    expect(
      hasJsxAttributeOnComponent(
        rich!.ast,
        'ChapterReferencesSidebar',
        'currentText',
        'activeChapterText',
      ),
    ).toBe(true)
    expect(
      hasJsxAttributeOnComponent(rich!.ast, 'DrawerDock', 'currentText', 'activeChapterText'),
    ).toBe(true)
    expect(
      hasJsxAttributeOnComponent(
        writer!.ast,
        'DrawerComponent',
        'currentText',
        'activeChapterText',
      ),
    ).toBe(true)
  })

  it('keeps CheckTools rule/search input on the canonical semantic projection', () => {
    const checkTools = sources.find(
      (source) => source.relativeFile === 'src/components/tools/CheckTools.tsx',
    )
    expect(checkTools).toBeDefined()
    const scanCalls = collectCalls(
      checkTools!.ast,
      (call) => functionName(call.expression) === 'scan',
    )
    expect(scanCalls.length).toBeGreaterThan(0)
    expect(
      scanCalls.every((call) => call.arguments[0]?.getText(checkTools!.ast) === 'content'),
    ).toBe(true)
    expect(hasProjectorCall(variableInitializer(checkTools!.ast, 'content'))).toBe(true)
  })

  it('rejects raw storage/editor representations at every task, tool, and workflow boundary', () => {
    const audits = sources.map((source) => auditTaintedBoundaries(source))
    const violations = audits.flatMap((audit) => audit.violations)
    const pluginBoundaryFiles = audits.filter(
      (audit, index) =>
        audit.boundaryCalls > 0 && sources[index].relativeFile.startsWith('src/plugins/'),
    )

    expect(pluginBoundaryFiles.length).toBeGreaterThan(0)
    expect(violations, `raw representation at AI boundaries:\n${violations.join('\n')}`).toEqual([])
  })

  it('rejects direct model calls, old onAiPrompt/session interfaces, and delayed AI mocks', () => {
    const violations = sources.flatMap((source) => auditLegacyPaths(source))
    expect(violations, `legacy/direct AI paths:\n${violations.join('\n')}`).toEqual([])
  })

  it('proves the static gates catch direct, aliased, and editor-JSON bypass fixtures', () => {
    const unsafe = parseFixture(`
      function dispatch(chapter: { content: string }, editor: { getHTML(): string; getJSON(): unknown }) {
        const rawChapter = chapter.content
        const taskInput = { text: rawChapter }
        runPluginTask('demo', taskInput)
        runPluginTool('demo', { html: editor.getHTML() })
        runPluginWorkflow('demo', { document: editor.getJSON() })
      }
    `)
    const unsafeAudit = auditTaintedBoundaries(unsafe)
    expect(unsafeAudit.boundaryCalls).toBe(3)
    expect(unsafeAudit.violations).toHaveLength(3)

    const safe = parseFixture(`
      function dispatch(chapter: { id: string; content: string }) {
        const text = semanticTextFromContent(chapter.id, chapter.content, 1)
        const taskInput = { text }
        runPluginTask('demo', taskInput)
      }
    `)
    expect(auditTaintedBoundaries(safe).violations).toEqual([])
  })

  it('proves the legacy gate catches provider, prompt, old interface, and delayed-call fixtures', () => {
    const unsafe = parseFixture(
      `
        import { generateText } from '@ai-sdk/openai'
        const prompt = 'legacy prompt'
        function dispatch() {
          onAiPrompt(prompt)
          session.create()
          setTimeout(() => generateText({}), 10)
        }
      `,
      'src/components/Fixture.tsx',
    )
    const violations = auditLegacyPaths(unsafe)
    expect(violations.some((value) => value.includes('direct LLM provider import'))).toBe(true)
    expect(violations.some((value) => value.includes('component-level prompt variable'))).toBe(true)
    expect(violations.some((value) => value.includes('legacy AI identifier'))).toBe(true)
    expect(violations.some((value) => value.includes('legacy session/agent interface'))).toBe(true)
    expect(violations.some((value) => value.includes('setTimeout wraps an AI boundary'))).toBe(true)
  })
})
