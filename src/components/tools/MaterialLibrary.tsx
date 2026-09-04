import React, { useState } from 'react';
import { BookOpen, Sparkles, Search } from 'lucide-react';

interface PersonalityType {
  id: string;
  name: string;
  gender: '女' | '男';
  tagline: string;
  fit: string[];
  dims: { label: string; value: string }[];
}

const PERSONALITY_DATA: PersonalityType[] = [
  {
    id: 'f-1',
    name: '清冷白月光',
    gender: '女',
    tagline: '看似孤高清绝，实则心有炽热与执念',
    fit: ['修仙圣女', '隐世医仙', '清冷师姐'],
    dims: [
      { label: '核心魅力', value: '克制的深情与反差的脆弱' },
      { label: '处世哲学', value: '事不关己高高挂起，动我执念虽远必诛' },
      { label: '说话方式', value: '字句精练，声线平缓，情绪极少外露' },
      { label: '代表原型', value: '小龙女 / 陆雪琪' },
    ],
  },
  {
    id: 'f-2',
    name: '娇蛮小师妹',
    gender: '女',
    tagline: '活泼灵动，护短专一，嘴硬心软',
    fit: ['宗门团宠', '富贾千金', '世家娇女'],
    dims: [
      { label: '核心魅力', value: '生命力爆棚，毫无防备的全然信任' },
      { label: '处世哲学', value: '我认准的人，天王老子也不能欺负' },
      { label: '说话方式', value: '快言快语，带着娇嗔与傲娇' },
      { label: '代表原型', value: '岳灵珊 / 郭襄' },
    ],
  },
  {
    id: 'f-3',
    name: '腹黑魔女',
    gender: '女',
    tagline: '亦正亦邪，巧笑倩兮，翻手为云覆手为雨',
    fit: ['魔教圣女', '神秘商人', '情报刺客'],
    dims: [
      { label: '核心魅力', value: '智力在线，敢爱敢恨，不拘世俗礼法' },
      { label: '处世哲学', value: '规则是弱者的枷锁，利益与本心才是真理' },
      { label: '说话方式', value: '语带机锋，擅用问句与戏谑' },
      { label: '代表原型', value: '婠婠 / 赵敏' },
    ],
  },
  {
    id: 'm-1',
    name: '深沉隐忍狂',
    gender: '男',
    tagline: '背负血海深仇，步步为营，杀伐果断',
    fit: ['落魄皇子', '重生复仇者', '魔道卧底'],
    dims: [
      { label: '核心魅力', value: '极度理智下的孤勇与极致反杀' },
      { label: '处世哲学', value: '受辱不辩只记账，待到秋风起时杀无赦' },
      { label: '说话方式', value: '惜字如金，言出必行，眼神比话重' },
      { label: '代表原型', value: '梅长苏 / 萧炎' },
    ],
  },
  {
    id: 'm-2',
    name: '风流洒脱浪子',
    gender: '男',
    tagline: '放荡不羁，一壶浊酒一把剑，心存大义',
    fit: ['游侠剑客', '散修高人', '宗门弃徒'],
    dims: [
      { label: '核心魅力', value: '看透世事的豁达与关键时刻的担当' },
      { label: '处世哲学', value: '大闹一场，悄然离去' },
      { label: '说话方式', value: '幽默自嘲，大笑谈生死' },
      { label: '代表原型', value: '令狐冲 / 酒剑仙' },
    ],
  },
  {
    id: 'm-3',
    name: '温润如玉君子',
    gender: '男',
    tagline: '谦谦君子，温良恭俭，内藏风雷',
    fit: ['世家大师兄', '皇朝国士', '儒门圣手'],
    dims: [
      { label: '核心魅力', value: '真正的仁义与不可动摇的原则底线' },
      { label: '处世哲学', value: '以直报怨，以德报德，匡扶正道' },
      { label: '说话方式', value: '礼数周全，温和却坚定' },
      { label: '代表原型', value: '花满楼 / 楚留香' },
    ],
  },
];

export const MaterialLibrary: React.FC = () => {
  const [filterGender, setFilterGender] = useState<'all' | '女' | '男'>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = PERSONALITY_DATA.filter((p) => {
    if (filterGender !== 'all' && p.gender !== filterGender) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.fit.some((f) => f.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[var(--ink-bg)] text-[var(--ink-text)] p-6 select-none">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">角色性格与素材资料库</h1>
          <BookOpen className="w-4 h-4 text-[var(--ink-accent)]" />
        </div>
        <p className="mt-1 text-xs text-[var(--ink-text-muted)]">
          人物性格原型 · 核心魅力与处世哲学 · 设定灵感速查
        </p>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 max-w-5xl">
        <div className="flex gap-1.5">
          {(['all', '女', '男'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterGender === g
                  ? 'bg-[var(--ink-accent)] text-white'
                  : 'bg-[var(--ink-bg-card)] border border-[var(--ink-border)] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)]'
              }`}
            >
              {g === 'all' ? '全部人物' : `${g}性原型`}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-text-muted)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索性格名称 / 适配定位..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[var(--ink-bg-card)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
          />
        </div>
      </div>

      {/* Grid of Character Archetypes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
        {filtered.map((item) => {
          const isExpanded = expandedId === item.id;
          return (
            <div
              key={item.id}
              className="rounded-xl bg-[var(--ink-bg-card)] border border-[var(--ink-border)] p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-[var(--ink-border)]/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[var(--ink-text)]">{item.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--ink-bg-hover)] text-[var(--ink-text-muted)]">
                      {item.gender}
                    </span>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-[var(--ink-accent)]" />
                </div>
                <p className="text-xs text-[var(--ink-text-muted)] mt-2 leading-relaxed">{item.tagline}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {item.fit.map((f, fIdx) => (
                    <span
                      key={fIdx}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--ink-bg)] border border-[var(--ink-border)] text-[var(--ink-accent)]"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                {/* Details Accordion */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-[var(--ink-border)]/50 space-y-2 text-xs">
                    {item.dims.map((dim, dIdx) => (
                      <div key={dIdx} className="space-y-0.5">
                        <span className="text-[10px] font-bold text-[var(--ink-text-muted)]">{dim.label}：</span>
                        <p className="text-xs text-[var(--ink-text)]">{dim.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-[var(--ink-border)]/30 flex justify-end">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="text-xs text-[var(--ink-accent)] hover:underline font-medium"
                >
                  {isExpanded ? '收起详情' : '展开多维人设解析 →'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
