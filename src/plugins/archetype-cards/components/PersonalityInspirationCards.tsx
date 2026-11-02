import { useMemo, useState } from 'react'
import { Search, Sparkles } from 'lucide-react'

interface PersonalityType {
  id: string
  name: string
  gender: '女' | '男'
  tagline: string
  fit: string[]
  dims: { label: string; value: string }[]
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
]

export function PersonalityInspirationCards() {
  const [gender, setGender] = useState<'all' | '女' | '男'>('all')
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return PERSONALITY_DATA.filter((item) => {
      if (gender !== 'all' && item.gender !== gender) return false
      if (!normalized) return true
      return (
        item.name.toLocaleLowerCase().includes(normalized) ||
        item.tagline.toLocaleLowerCase().includes(normalized) ||
        item.fit.some((fit) => fit.toLocaleLowerCase().includes(normalized))
      )
    })
  }, [gender, query])

  return (
    <section className="space-y-4" aria-label="经典人物性格原型卡">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1.5" aria-label="按性别筛选">
          {(['all', '女', '男'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={gender === value}
              onClick={() => setGender(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                gender === value
                  ? 'bg-[var(--ink-accent)] text-white'
                  : 'border border-[var(--ink-border)] bg-[var(--ink-bg-card)] text-[var(--ink-text-muted)]'
              }`}
            >
              {value === 'all' ? '全部人物' : `${value}性原型`}
            </button>
          ))}
        </div>
        <label className="relative block w-64">
          <span className="sr-only">搜索性格名称或适配定位</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-text-muted)]" />
          <input
            type="search"
            aria-label="搜索性格名称或适配定位"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索性格名称 / 适配定位..."
            className="w-full rounded-lg border border-[var(--ink-border)] bg-[var(--ink-bg-card)] py-1.5 pl-8 pr-3 text-xs text-[var(--ink-text)] focus:outline-none focus:ring-1 focus:ring-[var(--ink-accent)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const expanded = expandedId === item.id
          return (
            <article
              key={item.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-card)] p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between border-b border-[var(--ink-border)]/50 pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[var(--ink-text)]">{item.name}</h3>
                    <span className="rounded bg-[var(--ink-bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--ink-text-muted)]">
                      {item.gender}
                    </span>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-[var(--ink-accent)]" />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-text-muted)]">
                  {item.tagline}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.fit.map((fit) => (
                    <span
                      key={fit}
                      className="rounded-md border border-[var(--ink-border)] bg-[var(--ink-bg)] px-2 py-0.5 text-[10px] text-[var(--ink-accent)]"
                    >
                      {fit}
                    </span>
                  ))}
                </div>
                {expanded && (
                  <div className="mt-4 space-y-2 border-t border-[var(--ink-border)]/50 pt-3 text-xs">
                    {item.dims.map((dimension) => (
                      <div key={dimension.label} className="space-y-0.5">
                        <span className="text-[10px] font-bold text-[var(--ink-text-muted)]">
                          {dimension.label}：
                        </span>
                        <p className="text-xs text-[var(--ink-text)]">{dimension.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 flex justify-end border-t border-[var(--ink-border)]/30 pt-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  className="text-xs font-medium text-[var(--ink-accent)] hover:underline"
                >
                  {expanded ? '收起详情' : '展开多维人设解析 →'}
                </button>
              </div>
            </article>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-xs text-[var(--ink-text-muted)]">没有符合条件的性格原型。</p>
        )}
      </div>
    </section>
  )
}
