// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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
 */
const FORBIDDEN_LAYERS = ['src/components', 'src/domain', 'src/core', 'src/hooks', 'src/plugins']

const AI_AUTHORITATIVE_STORE_ACCESS =
  /\bdb\.(?:put|get|getAll|delete)\s*\(\s*["'](?:projects|volumes|chapters|domainChangeSets|domainProjectionCursors)["']/i

/**
 * INV-02 要求 chapters / domainChangeSets 只能经由唯一 mutation 通道落盘。原先的守卫
 * 只匹配 `db.put('chapters')` 这种便利调用，而真实旁路是裸事务
 * （`transaction.objectStore('chapters')`），完全不在扫描范围内。这里同时覆盖两种写法，
 * 并把扫描面从 src/ai 扩展到整个 src/（db 目录是 schema 本身，予以排除）。
 */
const AUTHORITATIVE_STORE_NAMES =
  'projects|volumes|chapters|domainChangeSets|domainProjectionCursors'
const AUTHORITATIVE_STORE_ACCESS = new RegExp(
  `objectStore\\(\\s*["'](?:${AUTHORITATIVE_STORE_NAMES})["']|\\bdb\\.(?:put|add|delete)\\s*\\(\\s*["'](?:${AUTHORITATIVE_STORE_NAMES})["']`,
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
function walkAllSources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'db' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) {
      out.push(...walkAllSources(p))
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
