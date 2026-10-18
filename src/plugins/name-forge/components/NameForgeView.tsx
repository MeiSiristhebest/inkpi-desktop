import { useEffect, useState, type FC } from 'react'
import type { DesktopPluginViewProps } from '../../../types/plugin'
import type { NameCategory, NameStyle, GeneratedNameItem } from '../types'
import { nameForgeEngine } from '../engine/NameForgeEngine'
import { PhoneticsEvaluator } from '../engine/PhoneticsEvaluator'
import { indexedDbCodexEntityRepository } from '../../../adapters/indexedDbCodexEntityRepository'
import { codexApplicationService } from '../../../services/domainApplicationServices'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { clock } from '../../../adapters/clock'
import { idGenerator } from '../../../adapters/idGenerator'
import { Select } from '../../../ui/primitives'
import type { CodexCategory } from '../../living-codex/types'
const CATEGORIES: Record<NameCategory, string> = {
  character_cn: '东方人名',
  character_western: '西式词库人名',
  sect_faction: '组织势力',
  technique_spell: '能力与术式',
  item_artifact: '物品',
  location_realm: '地点',
}
const STYLES: Record<NameStyle, string> = {
  balanced: '全部词库',
  cold_sharp: '冷峻词库',
  domineering: '强势词库',
  ethereal: '轻灵词库',
  demonic: '幽暗词库',
  elegant: '文雅词库',
}
export const NameForgeView: FC<DesktopPluginViewProps> = (props) => (
  <NamingWorkspace key={props.projectId} {...props} />
)
function NamingWorkspace({ projectId }: DesktopPluginViewProps) {
  const [category, setCategory] = useState<NameCategory>('character_cn')
  const [style, setStyle] = useState<NameStyle>('balanced')
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('neutral')
  const [prefix, setPrefix] = useState('')
  const [core, setCore] = useState('')
  const [count, setCount] = useState('10')
  const [min, setMin] = useState('1')
  const [max, setMax] = useState('12')
  const [excluded, setExcluded] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [existing, setExisting] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [reload, setReload] = useState(0)
  const [generation, setGeneration] = useState<{
    scope: string
    items: GeneratedNameItem[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [nameToRead, setNameToRead] = useState('')
  const [readings, setReadings] = useState('')
  const scope = JSON.stringify([
    projectId,
    category,
    style,
    gender,
    prefix,
    core,
    count,
    min,
    max,
    excluded,
    forbidden,
  ])
  const items = generation?.scope === scope ? generation.items : []
  useEffect(() => {
    let disposed = false
    setLoaded(false)
    indexedDbCodexEntityRepository
      .getAll()
      .then((entities) => {
        if (disposed) return
        setExisting(
          entities
            .filter((e) => e.projectId === projectId)
            .flatMap((e) => [e.name, ...(e.aliases ?? [])]),
        )
        setLoaded(true)
      })
      .catch((cause) => {
        if (!disposed) setError(String(cause))
      })
    return () => {
      disposed = true
    }
  }, [projectId, reload])
  const generate = () => {
    setError('')
    setMessage('')
    try {
      if (count === '' || min === '' || max === '') throw new Error('填写候选数量和长度范围。')
      const results = nameForgeEngine.generateNames({
        category,
        style,
        gender,
        count: Number(count),
        minLength: Number(min),
        maxLength: Number(max),
        fixedPrefix: prefix.trim() || undefined,
        fixedKern: core.trim() || undefined,
        excludedNames: [
          ...existing,
          ...excluded
            .split(/[\n,，]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ],
        forbiddenFragments: forbidden
          .split(/[\n,，]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      })
      setGeneration({ scope, items: results })
      setMessage(
        '请求 ' + count + ' 条，得到 ' + results.length + ' 条不同候选；约束或重复可能限制数量。',
      )
    } catch (cause) {
      setGeneration(null)
      setError(String(cause))
    }
  }
  const save = async (item: GeneratedNameItem) => {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      if (!projectId.trim()) throw new Error('选择实际作品后才能收录。')
      const fresh = await indexedDbCodexEntityRepository.getAll()
      if (
        fresh.some(
          (e) =>
            e.projectId === projectId && (e.name === item.name || e.aliases?.includes(item.name)),
        )
      )
        throw new Error('该名称或别名已存在，未重复收录。')
      const category: CodexCategory =
        item.category === 'sect_faction'
          ? 'faction'
          : item.category === 'location_realm'
            ? 'location'
            : item.category === 'technique_spell' || item.category === 'item_artifact'
              ? 'item'
              : 'character'
      if (nameToRead === item.name && readingError) throw new Error(readingError)
      const now = clock.now()
      await codexApplicationService.saveEntity(
        {
          id: idGenerator.generate('codex'),
          projectId,
          name: item.name,
          aliases: [],
          category,
          attributes: {
            namingStyle: item.style,
            ...(nameToRead === item.name && phonetics ? { authorReadingTones: readings } : {}),
          },
          relations: [],
          summary: '',
          detailMarkdown: '',
          createdAt: now,
          updatedAt: now,
        },
        'author-confirmed',
      )
      setSavedNames((previous) => new Set([...previous, item.name]))
      setExisting((previous) => [...previous, item.name])
      setMessage('已收录名称草案；人物背景和设定尚待作者填写。')
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }
  let phonetics: ReturnType<typeof PhoneticsEvaluator.evaluatePhonetics> | null = null,
    readingError = ''
  if (nameToRead && readings.trim()) {
    try {
      const tones = readings
        .trim()
        .split(/[\s,，]+/)
        .map((value) => {
          if (value === '?') return null
          if (!/^[0-4]$/.test(value)) throw new Error('声调只接受 1 至 4；未知或轻声用 0、?。')
          return Number(value)
        })
      phonetics = PhoneticsEvaluator.evaluatePhonetics(nameToRead, tones)
    } catch (cause) {
      readingError = String(cause)
    }
  }
  return (
    <div className="p-6 space-y-4 h-full overflow-y-auto">
      <h2>作者约束命名</h2>
      <p>
        候选按词库片段组合；字义、文化背景和读音尚未校核。收录只写入名称草案，不生成角色历史或能力。
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!loaded && <p>作品名称尚未读取；可重试后生成，避免遗漏已登记名称。</p>}
      <button onClick={() => setReload((n) => n + 1)}>重新读取作品名称</button>
      <Select
        aria-label="命名类别"
        value={category}
        onValueChange={(value) => setCategory(value as NameCategory)}
      >
        {Object.entries(CATEGORIES).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="命名词库风格"
        value={style}
        onValueChange={(value) => setStyle(value as NameStyle)}
      >
        {Object.entries(STYLES).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
      {category === 'character_western' && (
        <Select
          aria-label="西式人名词库"
          value={gender}
          onValueChange={(v) => setGender(v as 'male' | 'female' | 'neutral')}
        >
          <option value="neutral">合并人名词库</option>
          <option value="male">词库 A</option>
          <option value="female">词库 B</option>
        </Select>
      )}
      <input
        aria-label="固定名称开头"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
        placeholder="固定姓氏或开头片段"
      />
      <input
        aria-label="固定名称核心"
        value={core}
        onChange={(e) => setCore(e.target.value)}
        placeholder="必须保留的字辈或片段"
      />
      <label>
        数量
        <input
          aria-label="候选数量"
          type="number"
          min="0"
          max="100"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      <label>
        最短
        <input
          aria-label="名称最短长度"
          type="number"
          min="1"
          value={min}
          onChange={(e) => setMin(e.target.value)}
        />
      </label>
      <label>
        最长
        <input
          aria-label="名称最长长度"
          type="number"
          min="1"
          max="80"
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
      </label>
      <textarea
        aria-label="排除的完整名称"
        value={excluded}
        onChange={(e) => setExcluded(e.target.value)}
        placeholder="完整名称，逗号或换行分隔"
      />
      <textarea
        aria-label="禁用名称片段"
        value={forbidden}
        onChange={(e) => setForbidden(e.target.value)}
        placeholder="不允许出现的片段，逗号或换行分隔"
      />
      <button disabled={!loaded} onClick={generate}>
        生成约束内候选
      </button>
      {!items.length && <p>当前没有候选；调整条件后生成。</p>}
      {items.map((item) => (
        <article key={item.id} className="border rounded p-3 space-y-2">
          <h3>{item.name}</h3>
          <p>{item.meaningOrVibe}</p>
          <button
            onClick={async () => {
              setError('')
              setMessage('')
              try {
                await clipboardWriter.writeText(item.name)
                setMessage('已复制名称。')
              } catch (cause) {
                setError(String(cause))
              }
            }}
          >
            复制名称
          </button>
          <button disabled={saving || savedNames.has(item.name)} onClick={() => save(item)}>
            {savedNames.has(item.name) ? '已收录' : '收录名称草案'}
          </button>
          <button
            onClick={() => {
              setNameToRead(item.name)
              setReadings('')
            }}
          >
            填写此名读音
          </button>
        </article>
      ))}
      <h3>作者读音核对</h3>
      <input
        aria-label="待记录读音的名称"
        value={nameToRead}
        onChange={(e) => {
          setNameToRead(e.target.value)
          setReadings('')
        }}
      />
      <input
        aria-label="作者提供的声调"
        value={readings}
        onChange={(e) => setReadings(e.target.value)}
        placeholder="每个字符对应一个现代声调；用空格分隔"
      />
      <p>
        只按作者提供的现代声调分组；多音字须按实际名字的读法填写，轻声与缺失读音不归入平仄。不判断名字美感。
      </p>
      {readingError && <p role="alert">{readingError}</p>}
      {phonetics && (
        <p>
          已提供 {phonetics.knownToneCount}/{phonetics.totalCharacters} 个字符读音；分组{' '}
          {phonetics.pattern}；严格交替：
          {phonetics.isAlternating === null ? '未知' : phonetics.isAlternating ? '是' : '否'}。
        </p>
      )}
    </div>
  )
}
