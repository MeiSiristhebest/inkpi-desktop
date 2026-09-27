import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * §P2.5 要求所有评分型功能标出来源（即时规则 / AI 分析 / 历史数据模型 / 用户设定 / 推测）。
 * 逐个人工核对只能保证今天成立，所以这里按源码扫：任何把数字端成「指数 / 评分 / 概率 / 置信度」
 * 的插件视图，必须同时在源码里给出来源（共享徽章 `ScoreProvenanceBadge` 或一条 `来源：` 说明）。
 * 这是一条 source contract 断言，和仓库里既有的架构边界测试同一手法。
 */

const SCORE_VOCABULARY = /指数|评分|得分|概率|置信度|清洁度|健康度|势能|张力值|覆盖率|留存/
const PROVENANCE_MARKER = /ScoreProvenanceBadge|来源[：:]/

function viewFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === 'components' && statSync(path).isDirectory()) {
      for (const file of readdirSync(path)) {
        if (!file.endsWith('.tsx') || file.includes('.test.')) continue
        found.push(join(path, file))
      }
    } else if (statSync(path).isDirectory() && !entry.startsWith('_')) {
      viewFiles(path, found)
    }
  }
  return found
}

describe('评分来源契约（§P2.5）', () => {
  it('scans a non-trivial population of plugin views', () => {
    expect(viewFiles(join(__dirname)).length).toBeGreaterThan(90)
  })

  it('every view that renders a score states where the number comes from', () => {
    const unlabeled = viewFiles(join(__dirname)).filter((path) => {
      const source = readFileSync(path, 'utf8')
      return SCORE_VOCABULARY.test(source) && !PROVENANCE_MARKER.test(source)
    })
    expect(
      unlabeled.map((path) =>
        path.replace(/\\/g, '/').replace(/^.*src\/plugins\//, 'src/plugins/'),
      ),
    ).toEqual([])
  })
})
