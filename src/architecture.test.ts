// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

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

describe('架构依赖方向守卫', () => {
  const root = process.cwd()
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
})
