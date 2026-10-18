import { useState, type FC } from 'react'
import type { DesktopPluginDrawerProps } from '../../../types/plugin'
import type { NameCategory, GeneratedNameItem } from '../types'
import { nameForgeEngine } from '../engine/NameForgeEngine'
import { clipboardWriter } from '../../../adapters/clipboardWriter'
import { Select } from '../../../ui/primitives'
export const NameForgeDrawer: FC<DesktopPluginDrawerProps> = (props) => (
  <NamingDrawerBody key={props.projectId} />
)
function NamingDrawerBody() {
  const [category, setCategory] = useState<NameCategory>('character_cn')
  const [prefix, setPrefix] = useState('')
  const [core, setCore] = useState('')
  const [generated, setGenerated] = useState<{ scope: string; items: GeneratedNameItem[] } | null>(
    null,
  )
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const scope = JSON.stringify([category, prefix, core])
  return (
    <aside data-testid="name-forge-drawer" className="p-4 space-y-3 text-xs">
      <h3>命名候选</h3>
      <p>词库组合，读音和背景尚未校核。</p>
      <Select
        aria-label="侧栏命名类别"
        value={category}
        onValueChange={(value) => setCategory(value as NameCategory)}
      >
        <option value="character_cn">东方人名</option>
        <option value="character_western">西式词库</option>
        <option value="sect_faction">组织势力</option>
        <option value="technique_spell">能力术式</option>
        <option value="item_artifact">物品</option>
        <option value="location_realm">地点</option>
      </Select>
      <input aria-label="侧栏固定开头" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
      <input aria-label="侧栏必需片段" value={core} onChange={(e) => setCore(e.target.value)} />
      <button
        onClick={() => {
          setError('')
          try {
            setGenerated({
              scope,
              items: nameForgeEngine.generateNames({
                category,
                count: 5,
                fixedPrefix: prefix || undefined,
                fixedKern: core || undefined,
              }),
            })
          } catch (cause) {
            setError(String(cause))
          }
        }}
      >
        生成命名候选
      </button>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {generated?.scope === scope &&
        generated.items.map((item) => (
          <p key={item.id}>
            {item.name}
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
          </p>
        ))}
    </aside>
  )
}
