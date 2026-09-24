import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'

const TOPICS = ['红楼梦', '红楼梦判词', '红拂', '人物志', '写作手法', '夜色与灯']
const FONTS = [
  { label: '霞鹜文楷', value: 'wenkai' },
  { label: '思源宋体', value: 'serif' },
  { label: '黑体', value: 'sans' },
]

// 已有文本再获得焦点，正是 tauri#15436 声称会触发 WebView2 冻结的条件。
const SEEDED = '第三章　夜色里的旧城墙下面，灯一盏一盏地灭了。'

// 让三个可编辑面用生产字体与行距：候选窗位置偏移是否合理，取决于字族和 leading，
// 用 system-ui 量出来的结论迁移不到正文编辑器上。
const prose: CSSProperties = {
  fontFamily: 'var(--ink-font-wenkai)',
  fontSize: 17,
  lineHeight: 1.7,
}

type LogRow = { at: string; kind: string; detail: string }

function stamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false })
}

export default function ImeHarness() {
  const [log, setLog] = useState<LogRow[]>([])
  const [stall, setStall] = useState(0)
  const [typed, setTyped] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [font, setFont] = useState<string | null>(null)

  const push = (kind: string, detail: string) =>
    setLog((rows) => [{ at: stamp(), kind, detail }, ...rows].slice(0, 40))

  // 心跳：主线程被 WebView2/TSF 卡住时，rAF 间隔会突然拉大。这是客观读数，
  // 不靠人主观判断「好像卡了一下」。
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let worst = 0
    const tick = () => {
      const now = performance.now()
      worst = Math.max(worst, now - last)
      last = now
      setStall(Math.round(worst))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CompositionEvent
      const target = e.target as HTMLElement | null
      push(e.type, `${target?.tagName.toLowerCase() ?? '?'} data=${JSON.stringify(ce.data ?? '')}`)
    }
    const opts = { capture: true } as const
    for (const t of ['compositionstart', 'compositionupdate', 'compositionend']) {
      window.addEventListener(t, handler, opts)
    }
    return () => {
      for (const t of ['compositionstart', 'compositionupdate', 'compositionend']) {
        window.removeEventListener(t, handler, opts)
      }
    }
  }, [])

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: '在这里用拼音继续写……' })],
    content: `<p>${SEEDED}</p>`,
  })

  const editableRef = useRef<HTMLDivElement>(null)
  const prewarmRef = useRef<HTMLTextAreaElement>(null)

  // tauri#15436 报告者给出的唯一缓解手段：先让一个空 textarea 走一遍 focus/blur，
  // 把 TSF 上下文初始化好，之后再聚焦「已有文字」的字段就不一定冻结。
  // 这里把它做成手动按钮，方便 A/B：冻结 → 点一下 → 再打一遍，看是否复现。
  const prewarm = () => {
    const el = prewarmRef.current
    if (!el) return
    el.focus()
    el.blur()
    push('prewarm', 'dummy textarea focus/blur 已执行')
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 760, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 18 }}>InkPi 输入法实测算项面</h1>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        每一项都用微软拼音/搜狗打一遍：先点进已有文字里，再打「红楼梦判词」「夜色与灯」这种长词，
        然后按候选词、再直接点下面的列表项。右侧读数会自动记录。
      </p>

      <dl
        style={{
          display: 'flex',
          gap: 24,
          fontSize: 13,
          background: '#f6f6f4',
          padding: 12,
          borderRadius: 8,
        }}
      >
        <div>
          <dt style={{ opacity: 0.6 }}>主线程最大停顿</dt>
          <dd style={{ margin: 0, fontWeight: 700, color: stall > 400 ? '#c4544a' : '#0f6e56' }}>
            {stall} ms {stall > 400 ? '← 疑似冻结' : ''}
          </dd>
        </div>
        <div>
          <dt style={{ opacity: 0.6 }}>composition 事件数</dt>
          <dd style={{ margin: 0, fontWeight: 700 }}>{log.length}</dd>
        </div>
      </dl>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
        <button type="button" onClick={prewarm} style={{ padding: '6px 12px', fontSize: 13 }}>
          TSF 预热（#15436 的缓解手段）
        </button>
        <small style={{ opacity: 0.7 }}>
          若下面某一项一打字就冻结：点这个按钮，再重复同一次输入，对比结果。
        </small>
      </div>
      <textarea
        ref={prewarmRef}
        aria-label="TSF 预热用空输入框"
        tabIndex={-1}
        style={{ position: 'fixed', top: -1000, left: -1000, width: 1, height: 1, opacity: 0 }}
      />

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 14 }}>1. 已填内容的 input</h2>
        <input
          defaultValue={SEEDED}
          onCompositionEnd={(e) => setTyped(e.currentTarget.value)}
          style={{ ...prose, width: '100%', padding: 8 }}
          aria-label="已填内容的 input"
        />
        <small>当前值：{typed || '（未触发 compositionend）'}</small>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>2. 已填内容的 contenteditable（裸的）</h2>
        <div
          ref={editableRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="已填内容的 contenteditable"
          style={{
            ...prose,
            border: '1px solid #ccc',
            padding: 8,
            minHeight: 56,
            outline: 'none',
          }}
        >
          {SEEDED}
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>3. Tiptap 编辑器（真正的生产路径）</h2>
        <div
          className="ink-editor"
          style={
            {
              ...prose,
              border: '1px solid #ccc',
              padding: 8,
              '--ink-paragraph-spacing': '11px',
            } as CSSProperties
          }
        >
          <EditorContent editor={editor} />
        </div>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>4. Base UI Combobox（上游 #5574 的复现位）</h2>
        <Combobox.Root items={TOPICS} onValueChange={(v) => setSelected(v as string | null)}>
          <Combobox.Input aria-label="检索主题" style={{ padding: 8, width: 260 }} />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup style={{ background: '#fff', border: '1px solid #ccc' }}>
                <Combobox.Empty>没有匹配的主题</Combobox.Empty>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item
                      key={item}
                      value={item}
                      style={{ padding: 6, cursor: 'default' }}
                    >
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <small>已选：{selected ?? '（无）'}；输入框里若留着拼音字母即为缺陷复现</small>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 14 }}>5. Base UI Select（要替换 33 个原生 select 的目标）</h2>
        <Select.Root items={FONTS} value={font} onValueChange={(v) => setFont(v as string | null)}>
          <Select.Trigger aria-label="正文字体" style={{ padding: 8, width: 200 }}>
            <Select.Value placeholder="未选择" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup style={{ background: '#fff', border: '1px solid #ccc' }}>
                <Select.List>
                  {FONTS.map((f) => (
                    <Select.Item key={f.value} value={f.value} style={{ padding: 6 }}>
                      <Select.ItemText>{f.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 14 }}>事件流水</h2>
        <ul style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
          {log.map((r, i) => (
            <li key={i}>
              {r.at} · {r.kind} · {r.detail}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
