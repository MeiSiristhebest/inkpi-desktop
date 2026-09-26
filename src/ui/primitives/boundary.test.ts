// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..', '..')
const BOUNDARY = 'src/ui/primitives'

/**
 * 门面边界守卫。
 *
 * Base UI 仍是三起未修的中文输入法（composition）缺陷的引擎（#5574 / #4157 / #5366），
 * 而引擎在 shadcn 初始化时就被 components.json 的 style 冻结了。唯一让「换引擎」保持为
 * 门面内部改动的东西，就是这条边界：业务代码只能 import `@/ui/primitives`。
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

const toPosix = (file: string) => relative(root, file).split(sep).join('/')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
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

const sources = walk(join(root, 'src')).map((f) => ({
  path: toPosix(f),
  text: readFileSync(f, 'utf-8'),
}))

describe('UI 门面边界守卫', () => {
  it('业务代码不得直接 import UI 引擎，只能经 src/ui/primitives', () => {
    const violations = sources
      .filter((f) => !f.path.startsWith(`${BOUNDARY}/`))
      .filter((f) => ENGINE_PATTERN.test(f.text))
      .map((f) => f.path)
    expect(violations, `越过门面直接 import 引擎的文件: ${violations.join(', ')}`).toEqual([])
  })

  it('门面内的 cn 必须来自 @/lib/utils，而不是同名的 cn 包', () => {
    const violations = sources
      .filter((f) => f.path.startsWith(`${BOUNDARY}/`))
      .filter((f) => BARE_CN_PATTERN.test(f.text))
      .map((f) => f.path)
    expect(violations, `门面里 import 了裸 cn 包: ${violations.join(', ')}`).toEqual([])
  })

  it('门面内的 var() 只能取本项目真正会输出的令牌', () => {
    const tokens = readFileSync(join(root, 'src', 'index.css'), 'utf-8')
    const defined = new Set([...tokens.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]))
    const violations: string[] = []
    for (const file of sources.filter((f) => f.path.startsWith(`${BOUNDARY}/`))) {
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
