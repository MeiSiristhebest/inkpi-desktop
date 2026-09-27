// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTHORITATIVE_STORES } from './db/indexedDB'

// Resolve from the test file so the guard also works when Vitest is invoked
// through an absolute config/root path instead of the Desktop cwd.
const root = dirname(dirname(fileURLToPath(import.meta.url)))

/**
 * 架构依赖方向守卫。
 *
 * 六边形 / 端口与适配器约束：
 *   - 视图层（components）、领域层（domain）、核心层（core）、hooks、插件组件
 *     不得直接 import db/indexedDB（底层实现），必须经由 src/ports + src/adapters。
 *   - 上述层不得直接使用副作用型全局 API：window.confirm / navigator.clipboard /
 *     URL.createObjectURL，它们应分别走 confirmDialog / clipboardWriter /
 *     blobFileDownloader 端口，以保证纯函数 + 副作用隔离、可测试性。
 *   - 上述层不得直接调用非确定性源 Date.now() / Math.random()（生成 ID 或时间戳），
 *     应分别走 Clock / IdGenerator 端口；确定性纯函数如需时间可注入 now 参数。
 * 允许 src/adapters、src/db、src/ports 直接触碰这些实现（它们就是基础设施层）。
 *
 * 另加 L4：UI 引擎（@base-ui/react）只能被 src/ui/primitives 门面 import。
 * 见文件末尾的 'L4 · UI 引擎边界守卫'。
 */
const FORBIDDEN_LAYERS = ['src/components', 'src/domain', 'src/core', 'src/hooks', 'src/plugins']

// 权威 store 名单只有一个来源（src/db/indexedDB 的 AUTHORITATIVE_STORES），避免守卫与
// 清单测试各写一份、彼此漂移。
const AUTHORITATIVE_STORE_PATTERN = AUTHORITATIVE_STORES.join('|')

const AI_AUTHORITATIVE_STORE_ACCESS = new RegExp(
  `\\bdb\\.(?:put|get|getAll|delete)\\s*\\(\\s*["'](?:${AUTHORITATIVE_STORE_PATTERN})["']`,
  'i',
)

/**
 * INV-02 要求 chapters / domainChangeSets 只能经由唯一 mutation 通道落盘。原先的守卫
 * 只匹配 `db.put('chapters')` 这种便利调用，而真实旁路是裸事务
 * （`transaction.objectStore('chapters')`），完全不在扫描范围内。这里同时覆盖两种写法，
 * 并把扫描面从 src/ai 扩展到整个 src/（db 目录是 schema 本身，予以排除）。
 */
const AUTHORITATIVE_STORE_ACCESS = new RegExp(
  `objectStore\\(\\s*["'](?:${AUTHORITATIVE_STORE_PATTERN})["']|\\bdb\\.(?:put|add|delete)\\s*\\(\\s*["'](?:${AUTHORITATIVE_STORE_PATTERN})["']`,
)
/** 基础设施适配器：它们本身就是被授权的持久化实现。 */
const AUTHORITATIVE_STORE_ADAPTERS = [
  'src/adapters/indexedDbProjectRepository.ts',
  'src/adapters/indexedDbDomainChangeStore.ts',
]

const FORBIDDEN_PATTERNS: { re: RegExp; msg: string }[] = [
  { re: /from\s+['"][^'"]*\/db\/indexedDB['"]/, msg: '直接 import db/indexedDB（应走适配器端口）' },
  { re: /window\.confirm\s*\(/, msg: '直接使用 window.confirm（应使用 confirmDialog 端口）' },
  {
    re: /navigator\.clipboard/,
    msg: '直接使用 navigator.clipboard（应使用 clipboardWriter 端口）',
  },
  {
    re: /URL\.createObjectURL\s*\(/,
    msg: '直接使用 URL.createObjectURL（应使用 blobFileDownloader 端口）',
  },
  { re: /Date\.now\s*\(/, msg: '直接使用 Date.now()（应使用 Clock 端口）' },
  { re: /Math\.random\s*\(/, msg: '直接使用 Math.random()（应使用 IdGenerator 端口）' },
  {
    re: /\blocalStorage\.(getItem|setItem|removeItem|clear)\b/,
    msg: '直接使用 localStorage（应走 KeyValueStore 或 SettingsRepository 端口）',
  },
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (
      name === 'node_modules' ||
      name === 'adapters' ||
      name === 'db' ||
      name === 'ports' ||
      name === '.git'
    ) {
      continue
    }
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      out.push(...walk(p))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

/** 与 walk 不同：权威 store 守卫需要同时看到适配器层，才能区分「被授权」与「旁路」。 */
function walkAllSources(
  dir: string,
  skipDirs: ReadonlySet<string> = new Set(['node_modules', 'db', '.git']),
): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      out.push(...walkAllSources(p, skipDirs))
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

const toPosix = (file: string) => relative(root, file).split(sep).join('/')

/**
 * 已登记的历史旁路：AI proposal 的 commit/undo 需要 chapters 与 aiProposals 同事务，
 * 因此自带裸事务。这个清单只能变短——新增裸写者会让守卫失败，把这一条清空即代表
 * INV-02 真正闭合。
 */
const REGISTERED_BYPASS_WRITERS = ['src/ai/proposals/proposalChapterUnitOfWork.ts']

/* ── L4 · UI 引擎边界 ────────────────────────────────────────────────────── */

const BOUNDARY = 'src/ui/primitives'

/**
 * Base UI 仍带着三起未修的中文输入法（composition）缺陷（#5574 / #4157 / #5366），
 * 而引擎在 shadcn 初始化时就被 components.json 的 style 冻结了。唯一让「换引擎」
 * 保持为门面内部改动的东西，就是这条边界：业务代码只能 import `@/ui/primitives`。
 */
const ENGINE_PATTERN = /from\s+['"]@base-ui\/react/
/** shadcn 生成器会把 cn 写成裸包名；本项目的 cn 只有一个来源，就是 src/lib/utils。 */
const BARE_CN_PATTERN = /from\s+['"]cn['"]/

/**
 * 引擎在运行时写到 Positioner 内联样式上的定位变量（实测自 @base-ui/react 1.8.0 产物），
 * 不由 src/index.css 定义，因此不能按"未定义令牌"计。
 */
const RUNTIME_VARS = new Set([
  '--available-height',
  '--available-width',
  '--anchor-height',
  '--anchor-width',
  '--popup-height',
  '--popup-width',
  '--positioner-height',
  '--positioner-width',
  '--transform-origin',
])

describe('架构依赖方向守卫', () => {
  for (const layer of FORBIDDEN_LAYERS) {
    describe(layer, () => {
      let files: string[] = []
      try {
        files = walk(join(root, layer))
      } catch {
        // 该层目录不存在则跳过
      }

      for (const { re, msg } of FORBIDDEN_PATTERNS) {
        it(`不应 ${msg}`, () => {
          const violations = files
            .filter((f) => re.test(readFileSync(f, 'utf-8')))
            .map((f) => relative(root, f))
          expect(violations, `违反约束的文件: ${violations.join(', ')}`).toEqual([])
        })
      }
    })
  }

  describe('src/domain 领域层纯洁性守卫', () => {
    it('领域层代码不得 import 任何具体适配器（adapters）', () => {
      const files = walk(join(root, 'src/domain'))
      const adapterImportRe = /from\s+['"][^'"]*\/adapters\/[^'"]*['"]/
      const violations = files
        .filter((f) => adapterImportRe.test(readFileSync(f, 'utf-8')))
        .map((f) => relative(root, f))
      expect(violations, `违反领域纯洁性的文件: ${violations.join(', ')}`).toEqual([])
    })
  })

  describe('src/ai authoritative state boundary', () => {
    it('AI implementation may persist derived artifacts but not authoritative domain stores', () => {
      const aiRoot = join(root, 'src/ai')
      const files = walk(aiRoot)
      const violations = files
        .filter((file) => AI_AUTHORITATIVE_STORE_ACCESS.test(readFileSync(file, 'utf-8')))
        .map((file) => relative(root, file))
      AI_AUTHORITATIVE_STORE_ACCESS.lastIndex = 0
      expect(
        violations,
        `AI code references authoritative stores; return proposals through the task/proposal boundary: ${violations.join(', ')}`,
      ).toEqual([])
    })
  })

  describe('权威事实源写入边界 (INV-02)', () => {
    const writers = walkAllSources(join(root, 'src'))
      .filter((file) => AUTHORITATIVE_STORE_ACCESS.test(readFileSync(file, 'utf-8')))
      .map(toPosix)
      .sort()

    it('只有登记的持久化适配器可以裸写权威 store', () => {
      const bypassers = writers.filter((file) => !AUTHORITATIVE_STORE_ADAPTERS.includes(file))
      expect(
        bypassers,
        `新增权威 store 裸写者：请改走 ChapterMutationService，或在守卫中说明无法收口的原因: ${bypassers.join(', ')}`,
      ).toEqual(REGISTERED_BYPASS_WRITERS)
    })

    it('适配器清单与实际写入者保持一致，避免守卫悄悄失效', () => {
      const adaptersThatWrite = writers.filter((file) =>
        AUTHORITATIVE_STORE_ADAPTERS.includes(file),
      )
      expect(adaptersThatWrite).toEqual([...AUTHORITATIVE_STORE_ADAPTERS].sort())
    })
  })
})

describe('L4 · UI 引擎边界守卫', () => {
  // 引擎边界要看全：连 src/db 也在内，否则「漏检一个目录」会变成静默放宽。
  const sources = walkAllSources(join(root, 'src'), new Set(['node_modules', '.git'])).map(
    (file) => ({
      path: toPosix(file),
      text: readFileSync(file, 'utf-8'),
    }),
  )
  const facade = sources.filter((f) => f.path.startsWith(`${BOUNDARY}/`))
  const business = sources.filter((f) => !f.path.startsWith(`${BOUNDARY}/`))

  it('业务代码不得直接 import UI 引擎，只能经 src/ui/primitives', () => {
    const violations = business.filter((f) => ENGINE_PATTERN.test(f.text)).map((f) => f.path)
    expect(violations, `越过门面直接 import 引擎的文件: ${violations.join(', ')}`).toEqual([])
  })

  it('门面内的 cn 必须来自 @/lib/utils，而不是同名的 cn 包', () => {
    const violations = facade.filter((f) => BARE_CN_PATTERN.test(f.text)).map((f) => f.path)
    expect(violations, `门面里 import 了裸 cn 包: ${violations.join(', ')}`).toEqual([])
  })

  it('门面内的 var() 只能取本项目真正会输出的令牌', () => {
    const tokens = readFileSync(join(root, 'src', 'index.css'), 'utf-8')
    const defined = new Set([...tokens.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))
    const violations: string[] = []
    for (const file of facade) {
      // 一条模式覆盖两种写法：CSS 的 var(--x) 与 Tailwind v4 任意值简写 w-(--x)，
      // 因为两者都必然出现 `(--`。
      for (const match of file.text.matchAll(/\(\s*(--[a-zA-Z0-9-]+)/g)) {
        const name = match[1]
        // @theme inline 把值内联进工具类，--color-* 从不落到产物里；
        // shadcn 调色板变量（--secondary / --foreground …）在本项目也不存在。
        if (name.startsWith('--color-')) {
          violations.push(`${file.path}: ${name}（@theme inline 不输出该变量）`)
          continue
        }
        // Tailwind 默认主题在引用时输出 --radius-*；引擎在运行时自己写上定位变量。
        if (defined.has(name) || name.startsWith('--radius-') || RUNTIME_VARS.has(name)) continue
        violations.push(`${file.path}: ${name}（src/index.css 未定义）`)
      }
    }
    expect(violations, `门面引用了不会生效的 CSS 变量: ${violations.join(', ')}`).toEqual([])
  })
})
