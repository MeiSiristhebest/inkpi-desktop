// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { previewChoiceLabel, reviewStatusLabel } from '../ai/proposals/proposalVocabulary'
import type { PersistedReviewStatus } from '../ai/proposals/proposalVocabulary'
import type { ProposalStatus } from '../ai/proposals/proposalLedger'

// 从测试文件自身解析仓库根，Vitest 用绝对 config/root 启动时同样成立。
const root = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), '.')

/**
 * §P2.15 Proposal mutation contract.
 *
 * 一次审阅动作只有一套说法：Preview（重算合稿，不写库）/ Accepted（作者点头）/
 * Durable Applied（真的改了正文或设定库）/ Undo available / Stale / Rejected。
 * 插件视图不能自己发明状态词，否则「应用」在这个插件里只是 setState、在另一个插件里
 * 却真的重写正文，作者无从分辨。这里把词表钉死，并扫源码防止再分叉。
 */

const ALL_STATUSES: (ProposalStatus | PersistedReviewStatus)[] = [
  'pending',
  'accepted',
  'rejected',
  'stale',
  'committed',
  'undone',
  'applied',
]

/** 权威写入这一层的词，只能由 reviewStatusLabel / LIFECYCLE_LABELS 产出。 */
const DURATE_LABELS = ['已提交', '已采纳', '已落盘', '已忽略', '已撤销']

/** 各插件历史上自己发明的状态词，一律作废。 */
const INVENTED_STATUS_WORDS = [
  '待确认',
  '待审批',
  '已应用',
  '应用成功',
  '已生效',
  '一键套用',
  '一键应用',
]

function pluginViews(): string[] {
  const out: string[] = []
  const pluginsDir = join(root, 'src', 'plugins')
  for (const plugin of readdirSync(pluginsDir)) {
    const componentsDir = join(pluginsDir, plugin, 'components')
    try {
      if (!statSync(componentsDir).isDirectory()) continue
    } catch {
      continue
    }
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full)
        else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(full)
      }
    }
    walk(componentsDir)
  }
  return out
}

const views = pluginViews()
const rel = (file: string): string => relative(root, file).replaceAll('\\', '/')
const sourceOf = (file: string): string => readFileSync(file, 'utf8')

describe('proposal vocabulary (§P2.15)', () => {
  it('covers every proposal status with a durable label', () => {
    for (const status of ALL_STATUSES) {
      expect(reviewStatusLabel(status).length).toBeGreaterThan(0)
    }
  })

  it('keeps the durable axis on the canonical words', () => {
    expect(reviewStatusLabel('pending')).toBe('待审阅')
    // 基版本挪动之后作者仍然要决策，不能显示成一个新状态。
    expect(reviewStatusLabel('stale')).toBe('待审阅')
    expect(reviewStatusLabel('accepted')).toBe('已采纳')
    expect(reviewStatusLabel('committed')).toBe('已落盘')
    expect(reviewStatusLabel('rejected')).toBe('已忽略')
    expect(reviewStatusLabel('undone')).toBe('已撤销')
    // 插件自己的审阅记录用 applied 表示「已经写库」，说法必须与 committed 相同。
    expect(reviewStatusLabel('applied')).toBe(reviewStatusLabel('committed'))
  })

  it('keeps the preview axis free of durable words', () => {
    for (const choice of ['pending', 'applied', 'rejected'] as const) {
      const label = previewChoiceLabel(choice)
      expect(label).not.toBe(reviewStatusLabel(choice))
      for (const durable of [...DURATE_LABELS, '待审阅']) {
        expect(label).not.toContain(durable)
      }
    }
    expect(previewChoiceLabel('applied')).toBe('纳入预览')
  })

  it('scans plugin views', () => {
    // 守卫本身别变成空跑。
    expect(views.length).toBeGreaterThan(50)
  })

  it('forbids invented status words', () => {
    const hits: string[] = []
    for (const file of views) {
      const src = sourceOf(file)
      for (const word of INVENTED_STATUS_WORDS) {
        if (src.includes(word)) hits.push(`${rel(file)}: ${word}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('forbids hand-written durable labels instead of the shared vocabulary', () => {
    const hits: string[] = []
    for (const file of views) {
      const src = sourceOf(file)
      const usesVocabulary = /reviewStatusLabel|LIFECYCLE_LABELS/.test(src)
      if (usesVocabulary) continue
      for (const label of DURATE_LABELS) {
        // 只抓「被当成状态值写死」的字面量：'已落盘' / "已采纳" / >已忽略<。
        // 领域词里出现的 已故 / 已经 之类散文不算，避免误伤正常文案。
        const literals = [`'${label}'`, `"${label}"`, '`' + label + '`', `>${label}<`]
        const hit = literals.find((lit) => src.includes(lit))
        if (hit) hits.push(`${rel(file)}: ${label}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('forbids rendering a raw status enum to the author', () => {
    const hits: string[] = []
    for (const file of views) {
      const src = sourceOf(file)
      if (/status\s*\.\s*to(?:Upper|Lower)Case\s*\(/.test(src)) hits.push(rel(file))
    }
    expect(hits).toEqual([])
  })

  it('keeps the durable accept verb out of preview-only surfaces', () => {
    // 有「纳入预览」这一层的视图，不能再出现「采纳」：作者点一下究竟改了什么必须只有一个答案。
    const hits: string[] = []
    for (const file of views) {
      const src = sourceOf(file)
      if (!src.includes('previewChoiceLabel')) continue
      if (src.includes('采纳')) hits.push(`${rel(file)}: 采纳`)
      if (!src.includes('预览')) hits.push(`${rel(file)}: 缺少 Preview 说法`)
    }
    expect(hits).toEqual([])
  })

  it('discloses undo availability wherever a durable status is shown', () => {
    const hits: string[] = []
    for (const file of views) {
      const src = sourceOf(file)
      if (!src.includes('reviewStatusLabel')) continue
      if (!src.includes('撤销')) hits.push(rel(file))
    }
    expect(hits).toEqual([])
  })
})
