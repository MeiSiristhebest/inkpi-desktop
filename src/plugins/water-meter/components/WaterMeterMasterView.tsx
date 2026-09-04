import { useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { WaterAuditReport } from '../types'
import { waterMeterEngine } from '../engine/WaterMeterEngine'
import {
  Droplet,
  Zap,
  FileText,
  Sparkles,
  Scissors,
} from 'lucide-react'

const DEMO_TEXT = `众所周知，在整个修仙界中，所有人都忍不住倒吸了一口凉气。
陆沉心中掀起惊涛骇浪，暗暗心惊，只觉得自己整个人都不好了。
正如前文所言，九品金丹极其极其稀有，他深吸了一口气，下意识地面露震惊之色。`

export const WaterMeterMasterView: FC<DesktopPluginViewProps> = () => {
  const [inputText, setInputText] = useState(DEMO_TEXT)
  const [report, setReport] = useState<WaterAuditReport>(() =>
    waterMeterEngine.auditText(DEMO_TEXT)
  )

  const handleAudit = () => {
    setReport(waterMeterEngine.auditText(inputText))
  }

  const handleApplyClean = () => {
    // 快速去除识别出的所有冗余套话
    let cleaned = inputText
    for (const item of report.bloatItems) {
      cleaned = cleaned.replaceAll(item.text, '')
    }
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim()
    setInputText(cleaned)
    setReport(waterMeterEngine.auditText(cleaned))
  }

  return (
    <div className="h-full flex flex-col bg-[var(--ink-bg-canvas)] text-[var(--ink-text)] overflow-hidden">
      {/* 顶栏 */}
      <div className="border-b border-[var(--ink-border)] bg-[var(--ink-bg-panel)] p-4 shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">信息熵与水分压缩计</h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-500 font-medium">
              香农信息熵 · 假动作水文净化
            </span>
          </div>
          <p className="text-xs text-[var(--ink-text-muted)] mt-0.5">
            识别连载灌水、套话假动作与设定重述，测量叙事动能与信息密度，提供一键脱水建议
          </p>
        </div>

        <button
          onClick={handleAudit}
          className="px-3.5 py-1.5 rounded-lg bg-[var(--ink-accent)] text-white text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 shadow-sm"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>深度脱水体检</span>
        </button>
      </div>

      {/* 主体滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 指标看板 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">水分综合评分</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span
                className={`text-xl font-bold ${
                  report.waterScore > 50
                    ? 'text-rose-500'
                    : report.waterScore > 25
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }`}
              >
                {report.waterScore}
              </span>
              <span className="text-[10px] text-[var(--ink-text-muted)]">
                {report.waterLevel === 'flooded'
                  ? '重度注水'
                  : report.waterLevel === 'watery'
                    ? '明显偏水'
                    : report.waterLevel === 'normal'
                      ? '平稳正常'
                      : '精炼高能'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">香农信息熵 (0-8)</span>
            <span className="text-xl font-bold text-blue-400 mt-1 block">{report.entropyScore}</span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">动作动词密度 (AVR)</span>
            <span className="text-xl font-bold text-indigo-400 mt-1 block">
              {(report.actionVerbRatio * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">套话假动作占比</span>
            <span
              className={`text-xl font-bold mt-1 block ${
                report.clicheRatio > 0.05 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              {(report.clicheRatio * 100).toFixed(1)}%
            </span>
          </div>

          <div className="p-3 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)]">
            <span className="text-[11px] text-[var(--ink-text-muted)] block">预估脱水字数</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold text-emerald-500">{report.estimatedLeanWordCount}</span>
              <span className="text-[10px] text-[var(--ink-text-muted)]">
                (-{report.dehydrationRate}%)
              </span>
            </div>
          </div>
        </div>

        {/* 文本输入与脱水区 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左栏：文本输入 (7 列) */}
          <div className="lg:col-span-7 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                正文待审段落（当前字数：{report.totalWordCount}）
              </span>
              <button
                onClick={handleApplyClean}
                className="px-2.5 py-1 rounded bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] hover:border-emerald-500 text-emerald-500 text-xs font-medium flex items-center gap-1"
                title="自动剔除已识别出的所有假动作套话"
              >
                <Scissors className="w-3 h-3" />
                一键剔除水词
              </button>
            </div>

            <textarea
              rows={10}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="在此粘贴本章全文或段落..."
              className="w-full p-3 rounded-lg bg-[var(--ink-bg-canvas)] border border-[var(--ink-border)] text-xs text-[var(--ink-text)] leading-relaxed resize-none focus:outline-none"
            />

            {/* 写作建议 */}
            <div className="p-3 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] space-y-1 text-xs">
              <span className="font-semibold text-[var(--ink-text)] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                去水提纯优化建议：
              </span>
              {report.advice.map((adv, i) => (
                <p key={i} className="text-[11px] text-[var(--ink-text-muted)] flex items-start gap-1">
                  <span className="text-[var(--ink-accent)]">•</span>
                  <span>{adv}</span>
                </p>
              ))}
            </div>
          </div>

          {/* 右栏：抓捕到的水文列表 (5 列) */}
          <div className="lg:col-span-5 p-4 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-panel)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--ink-text)] flex items-center gap-1.5">
                <Droplet className="w-3.5 h-3.5 text-cyan-500" />
                抓捕到的冗余水词 ({report.bloatItems.length})
              </span>
            </div>

            {report.bloatItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--ink-text-muted)]">
                暂未发现明显的灌水套话，正文叙事纯度极高！
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {report.bloatItems.map((item, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-canvas)] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-400">“{item.text}”</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500">
                        {item.type === 'phantom'
                          ? '假动作套话'
                          : item.type === 'recap'
                            ? '设定重述'
                            : '修饰堆叠'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-text-muted)] leading-tight">
                      {item.reason}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
