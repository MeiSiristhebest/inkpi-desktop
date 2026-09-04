import { useState, useRef, type ChangeEvent } from 'react'
import { ImageIcon, X } from 'lucide-react'
import { defaultGenreFor } from '../../../domain/project/projectDefaults'
import { readCoverImage } from '../coverUpload'

interface CreateProjectPanelProps {
  onClose: () => void
  onCreate: (name: string, genre: string, intro: string) => void
}

/**
 * 展开式「新建小说项目」面板（原子设计 · organisms）。
 * 自身持有书名 / 封面 / 项目形态等临时状态；封面上传（FileReader + 体积校验）
 * 通过共享 readCoverImage 完成，仍走 UI 层的浏览器能力。提交时回传 (name, defaultGenre, '') 给父级。
 */
export const CreateProjectPanel = ({ onClose, onCreate }: CreateProjectPanelProps) => {
  const [name, setName] = useState('')
  const [cover, setCover] = useState('')
  const [projectType, setProjectType] = useState<'full' | 'custom'>('full')
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleCreate = () => {
    if (!name.trim()) return
    onCreate(name.trim(), defaultGenreFor(projectType), '')
  }

  return (
    <div className="mb-8 rounded-xl border border-[var(--ink-border)] bg-[var(--ink-bg-elevated)] p-5 shadow-[var(--ink-shadow)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-semibold text-[var(--ink-text)]">新建小说项目</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] p-1 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-5 flex-col sm:flex-row">
        {/* 封面上传占位 */}
        <div className="shrink-0">
          <div
            onClick={() => coverInputRef.current?.click()}
            className="group relative w-[88px] h-[123px] rounded-lg border border-dashed border-[var(--ink-border-strong)] hover:border-[var(--ink-accent)]/50 bg-[var(--ink-bg-panel)] overflow-hidden transition-colors flex items-center justify-center cursor-pointer select-none"
            title="上传封面（可选，2MB 以内）"
          >
            {cover ? (
              <>
                <img src={cover} alt="封面预览" className="w-full h-full object-cover" />
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    setCover('')
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除封面"
                >
                  <X size={11} />
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-[var(--ink-text-muted)] group-hover:text-[var(--ink-accent)] transition-colors">
                <ImageIcon size={20} />
                <span className="text-[10px]">上传封面</span>
              </div>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const f = e.target.files?.[0]
              if (f) readCoverImage(f).then((url) => url && setCover(url))
              e.target.value = ''
            }}
          />
        </div>

        {/* 表单项 */}
        <div className="flex-1 flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-[var(--ink-text-muted)] mb-1 block">项目形态</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProjectType('full')}
                className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                  projectType === 'full'
                    ? 'border-[var(--ink-accent)]/50 bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                }`}
              >
                <div className="text-[12.5px] font-medium">完整项目</div>
                <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">适合中长篇连载·功能最完整，开箱即用</div>
              </button>
              <button
                type="button"
                onClick={() => setProjectType('custom')}
                className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                  projectType === 'custom'
                    ? 'border-[var(--ink-accent)]/50 bg-[var(--ink-accent-soft)] text-[var(--ink-accent)]'
                    : 'border-[var(--ink-border)] bg-[var(--ink-bg-panel)] text-[var(--ink-text)] hover:border-[var(--ink-border-strong)]'
                }`}
              >
                <div className="text-[12.5px] font-medium">自定义项目</div>
                <div className="text-[10px] text-[var(--ink-text-muted)] mt-0.5">从功能全集里自由选择模块</div>
              </button>
            </div>
          </div>

          <div className="flex-1">
            <label className="text-[11px] text-[var(--ink-text-muted)] mb-1 block">书名 *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="给这本书起个名字，其他信息之后随时可以补"
              autoFocus
              className="w-full text-[13px] px-3 py-2 rounded-lg bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={!name.trim()}
            className="w-full h-9 rounded-lg bg-[var(--ink-accent)] text-white font-semibold text-[13px] hover:bg-[var(--ink-accent-hover)] disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            {name.trim() ? '创建并进入项目' : '创建并进入项目'}
          </button>
        </div>
      </div>
    </div>
  )
}
