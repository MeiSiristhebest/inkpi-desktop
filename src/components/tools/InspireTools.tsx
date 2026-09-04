import React, { useState } from 'react';
import { Sparkles, Copy, Check, Dices } from 'lucide-react';
import { clipboardWriter } from '../../adapters/clipboardWriter';
import {
  CATEGORIES,
  STYLES,
  generateInspiration,
  type InspireCategory,
  type InspireStyle,
} from './inspireStrategies';

export const InspireTools: React.FC = () => {
  const [activeCat, setActiveCat] = useState<InspireCategory>('人名');
  const [activeStyle, setActiveStyle] = useState<InspireStyle>('仙侠');
  const [results, setResults] = useState<string[]>(() =>
    Array.from({ length: 12 }, () => generateInspiration('人名', '仙侠'))
  );
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleRefresh = () => {
    setResults(Array.from({ length: 12 }, () => generateInspiration(activeCat, activeStyle)));
  };

  const handleCopy = async (text: string) => {
    await clipboardWriter.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1200);
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">灵感启发与随机生成器</h1>
          <Sparkles className="w-4 h-4 text-[var(--ink-accent)]" />
        </div>
        <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
          随机命名生成器 · 门派/功法/地名/法宝/人名 · 快速获取创作素材
        </p>
      </header>

      <div className="p-6 rounded-2xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] shadow-sm space-y-6 max-w-4xl">
        {/* 类型选择 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--ink-text-muted)]">生成类型：</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCat(cat);
                  setResults(Array.from({ length: 12 }, () => generateInspiration(cat, activeStyle)));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCat === cat
                    ? 'bg-[var(--ink-accent)] text-white'
                    : 'bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 风格选择 */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[var(--ink-text-muted)]">设定风格：</label>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((st) => (
              <button
                key={st}
                onClick={() => {
                  setActiveStyle(st);
                  setResults(Array.from({ length: 12 }, () => generateInspiration(activeCat, st)));
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeStyle === st
                    ? 'bg-[var(--ink-accent)] text-white'
                    : 'bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-text)] hover:bg-[var(--ink-bg-hover)]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* 刷新动作 */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--ink-border)]/50">
          <span className="text-xs text-[var(--ink-text-muted)]">点击词卡即可直接复制到剪贴板</span>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[var(--ink-accent)] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow hover:opacity-90 transition-opacity"
          >
            <Dices className="w-4 h-4" />
            换一批灵感
          </button>
        </div>

        {/* 结果卡片网格 */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleCopy(item)}
              className="p-3.5 rounded-xl bg-[var(--ink-bg)] border border-[var(--ink-border)] hover:border-[var(--ink-accent)] transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
            >
              <span className="text-xs font-bold text-[var(--ink-text)] group-hover:text-[var(--ink-accent)] transition-colors">
                {item}
              </span>
              <button className="text-[var(--ink-text-muted)] group-hover:text-[var(--ink-accent)]">
                {copiedText === item ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
