// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * §P4.1 交互契约守卫。
 *
 * 焦点契约（记住触发者 → 交给面板 → Tab 循环 → Esc 关闭 → 归还）此前在
 * Modal / Popover / 命令面板里各写了一份，三份的字面选择器还不一致：命令面板那份漏了
 * select / textarea / [tabindex]，也就是说 Tab 会跳出面板。现在只允许一处实现。
 *
 * 与 src/architecture.test.ts 同一套路：node 环境 + 直接扫源码，不依赖渲染。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const srcRoot = join(repoRoot, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

const toPosix = (file: string) => relative(repoRoot, file).split(sep).join('/')

/** 注释里的 «focus trap» «aria-modal="true"» 只是文档，不该被当成实现。 */
function withoutComments(source: string): string {
  return source
    .split('\n')
    .map((line) => (line.trimStart().startsWith('//') ? '' : line))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 焦点陷阱 = keydown 监听 + 对 'Tab' 的判断 + 手动 .focus()。三者缺一即只是普通按键处理。 */
const TRAP_PATTERN = /addEventListener\(\s*['"]keydown['"]/
const TAB_KEY_PATTERN = /\.key\s*[!=]==?\s*['"]Tab['"]/
const MANUAL_FOCUS_PATTERN = /\.focus\(/

const CONTRACT_OWNER = 'src/ui/useOverlayFocus.ts'

/** 模态外壳只允许住在 src/ui/molecules；业务层不得自己写 aria-modal。 */
const MODAL_SHELL_DIR = 'src/ui/molecules/'

interface ContractFile {
  path: string
  source: string
}

function overlayContractViolations(files: ContractFile[]): string[] {
  const violations: string[] = []
  for (const { path, source } of files) {
    const code = withoutComments(source)
    const isTrap =
      TRAP_PATTERN.test(code) && TAB_KEY_PATTERN.test(code) && MANUAL_FOCUS_PATTERN.test(code)
    if (isTrap && path !== CONTRACT_OWNER) {
      violations.push(`${path}: 自己实现了一份焦点陷阱（应使用 useOverlayFocus）`)
    }
    if (/aria-modal="true"/.test(code) && !path.startsWith(MODAL_SHELL_DIR)) {
      violations.push(`${path}: 业务层手搓了 aria-modal 模态语义（应使用 Modal / Popover）`)
    }
  }
  return violations
}

const realFiles: ContractFile[] = walk(srcRoot).map((p) => ({
  path: toPosix(p),
  source: readFileSync(p, 'utf8'),
}))

describe('§P4.1 全仓只有一份浮层交互契约', () => {
  it('确实扫到了源码，否则下面的断言是在空转', () => {
    expect(realFiles.length).toBeGreaterThan(150)
    const paths = realFiles.map((f) => f.path)
    for (const required of [
      CONTRACT_OWNER,
      'src/ui/molecules/Modal.tsx',
      'src/ui/molecules/Popover.tsx',
      'src/components/CommandPaletteModal.tsx',
    ]) {
      expect(paths).toContain(required)
    }
  })

  it('Modal 与 Popover 都接在同一份焦点契约上', () => {
    const sourceOf = (path: string) => {
      const found = realFiles.find((f) => f.path === path)
      expect(found, `${path} 应出现在扫描结果里`).toBeDefined()
      return found?.source ?? ''
    }
    expect(sourceOf('src/ui/molecules/Modal.tsx')).toMatch(/from '\.\.\/useOverlayFocus'/)
    expect(sourceOf('src/ui/molecules/Popover.tsx')).toMatch(/from '\.\.\/useOverlayFocus'/)
  })

  it('没有任何文件手搓焦点陷阱或模态语义', () => {
    expect(overlayContractViolations(realFiles)).toEqual([])
  })

  it('反证：检测器能认出这两种旁路', () => {
    const violations = overlayContractViolations([
      {
        path: 'src/components/RogueDialog.tsx',
        source: `
          useEffect(() => {
            const onKey = (e: KeyboardEvent) => {
              if (e.key !== 'Tab') return
              items[0].focus()
            }
            window.addEventListener('keydown', onKey)
          }, [])
        `,
      },
      {
        path: 'src/components/AnotherPalette.tsx',
        source: '<div role="dialog" aria-modal="true">x</div>',
      },
      {
        path: 'src/ui/molecules/Modal.tsx',
        source: '<div role="dialog" aria-modal="true">x</div>',
      },
    ])
    expect(violations).toEqual([
      'src/components/RogueDialog.tsx: 自己实现了一份焦点陷阱（应使用 useOverlayFocus）',
      'src/components/AnotherPalette.tsx: 业务层手搓了 aria-modal 模态语义（应使用 Modal / Popover）',
    ])
  })
})
