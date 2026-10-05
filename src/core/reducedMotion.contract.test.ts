// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * P4.5 reduced motion 的收口测试。
 *
 * 这里刻意读源码而不是渲染组件：CSS 层的关键帧覆盖无法在 jsdom 里计算，
 * 而 App 根一旦丢掉 MotionConfig，motion 动画就不再读系统偏好。
 * 两者都属于「改一行就静默失效、但没有任何运行时报错」的边界，
 * 所以用契约测试钉住，和 tauriCsp.contract.test.ts 同一套路。
 */

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath: string) => readFileSync(join(srcRoot, relativePath), 'utf8')
const relativeTo = (path: string) => relative(srcRoot, path)

/** 取出 `@media (prefers-reduced-motion: reduce)` 这一块的正文（含大括号）。 */
function reducedMotionBlock(css: string): string {
  const start = css.indexOf('@media (prefers-reduced-motion: reduce)')
  expect(start, 'P4.5：index.css 必须保留 prefers-reduced-motion 兜底层').toBeGreaterThanOrEqual(0)
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(start, i + 1)
    }
  }
  throw new Error('prefers-reduced-motion 媒体查询的括号没有闭合')
}

describe('reduced motion 的 CSS 兜底层（P4.5）', () => {
  const block = reducedMotionBlock(read('index.css'))

  it('同时封掉时长与循环次数，否则无限动画会变成高频频闪', () => {
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })

  it('覆盖伪元素，而不只是元素本身', () => {
    const selector = block
      .slice(block.indexOf('{') + 1, block.indexOf('{', block.indexOf('{') + 1))
      .split(',')
      .map((part) => part.trim())
    expect(selector).toEqual(['*', '*::before', '*::after'])
  })

  it('不依赖 !important 之外的选择器优先级', () => {
    // 动画声明只有 animate-spin / animate-pulse 这类 Tailwind 工具类，
    // 它们同为单类选择器；没有 !important 就会被后加载的工具类盖掉。
    const declarations = [...block.matchAll(/^\s+(animation|transition)[^:]*:.*$/gm)].map((m) =>
      m[0].trim(),
    )
    expect(declarations.length).toBeGreaterThanOrEqual(3)
    for (const declaration of declarations) {
      expect(declaration, `P4.5：${declaration} 缺 !important`).toContain('!important')
    }
  })
})

describe('reduced motion 的 motion 层（P4.5）', () => {
  const app = read('App.tsx')

  it('App 根用 MotionConfig reducedMotion="user" 包住业务外壳', () => {
    expect(app).toMatch(
      /<MotionConfig reducedMotion="user">[\s\S]*<AppShell \/>[\s\S]*<\/MotionConfig>/,
    )
  })

  it('全仓没有 repeat:Infinity 的自动循环动效绕过这一层', () => {
    // MotionConfig 在 reduced motion 下只掐位移与缩放，opacity 循环动画会继续跑，
    // 所以真正永不停歇的 JS 动效必须自己调 useReducedMotion() 关掉。
    // 这条断言用「扫全部源码」的方式正面支撑「目前不存在这种动效」的说法。
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue
        if (/repeat:\s*('infinity'|Infinity)/.test(readFileSync(full, 'utf8'))) {
          offenders.push(relativeTo(full))
        }
      }
    }
    walk(srcRoot)
    expect(offenders).toEqual([])
  })
})
