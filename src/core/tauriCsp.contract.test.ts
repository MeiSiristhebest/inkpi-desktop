// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const config = JSON.parse(
  readFileSync(join(repoRoot, 'src-tauri', 'tauri.conf.json'), 'utf8'),
) as TauriConfig

interface TauriConfig {
  app?: { security?: { csp?: string | null } }
}

const csp = config.app?.security?.csp
expect(csp, 'P5.2：打包版不得回到 csp:null').toBeTypeOf('string')

/** 取出某个指令的取值列表；指令不存在时返回 null，让断言以可读的方式失败。 */
function directiveSources(name: string): string[] | null {
  const entry = String(csp)
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `))
  if (!entry) return null
  return entry.slice(name.length).trim().split(/\s+/).filter(Boolean)
}

describe('打包版 CSP（P5.2）', () => {
  it('脚本、对象与表单都收紧到本机', () => {
    expect(directiveSources('script-src')).toEqual(["'self'"])
    expect(directiveSources('object-src')).toEqual(["'none'"])
    expect(directiveSources('base-uri')).toEqual(["'self'"])
    expect(directiveSources('form-action')).toEqual(["'self'"])
  })

  it('样式与字体不引用外部主机——这正是当年 CDN 字体在打包版静默失效的原因', () => {
    for (const source of directiveSources('style-src') ?? []) {
      expect(source).not.toMatch(/^https?:/)
    }
    expect(directiveSources('font-src')).toEqual(["'self'", 'data:'])
  })

  it('connect-src 只放行本机：渲染进程无法直连提供商端点', () => {
    // 这条边界决定了设置页的 Provider 探测为什么只能说「无法探测」而不能说「无法访问」：
    // src/adapters/modelProviderProbe.ts 的 fetch 发生在界面进程里。
    expect(directiveSources('connect-src')).toEqual([
      "'self'",
      'ipc:',
      'ws://127.0.0.1:*',
      'http://127.0.0.1:*',
    ])
  })
})
