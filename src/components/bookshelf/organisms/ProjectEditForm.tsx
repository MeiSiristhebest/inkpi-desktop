import { useState, useRef } from 'react'
import { ImageIcon, X, Check } from 'lucide-react'
import type { ProjectRecord } from '../../../types'
import { readCoverImage } from '../coverUpload'

export interface ProjectEditFormValues {
  name: string
  genre: string
  intro: string
  cover: string
}

interface ProjectEditFormProps {
  project: ProjectRecord
  onCancel: () => void
  onSave: (form: ProjectEditFormValues) => void
}

/**
 * 作品卡片内联编辑表单（原子设计 · organisms）。
 * 自身持有受控表单状态，保存时把原始值上抛，由父级统一做 trim / undefined 归一（保留原语义）。
 * 封面上传通过共享 readCoverImage 完成，仍走 UI 层的浏览器能力。
 */
export const ProjectEditForm = ({ project, onCancel, onSave }: ProjectEditFormProps) => {
  const [form, setForm] = useState<ProjectEditFormValues>({
    name: project.name,
    genre: project.genre || '',
    intro: project.intro || '',
    cover: project.cover || '',
  })
  const coverInputRef = useRef<HTMLInputElement>(null)

  const setField = (field: keyof ProjectEditFormValues, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl p-5 shadow-[var(--ink-shadow)]">
      <div className="flex items-start gap-4">
        <div
          onClick={() => coverInputRef.current?.click()}
          className="group/cover relative w-[100px] h-[140px] rounded-xl border border-dashed border-[var(--ink-border-strong)] hover:border-[var(--ink-accent)] overflow-hidden transition-all flex items-center justify-center shrink-0 cursor-pointer bg-[var(--ink-bg-panel)] shadow-inner"
          title="上传封面（可选，2MB 以内）"
        >
          {form.cover ? (
            <>
              <img src={form.cover} alt="封面" className="w-full h-full object-cover" />
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  setField('cover', '')
                }}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer"
                title="移除封面"
              >
                <X size={12} />
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-[var(--ink-text-muted)] group-hover/cover:text-[var(--ink-accent)] transition-colors">
              <ImageIcon size={18} />
              <span className="text-[11px]">上传封面</span>
            </div>
          )}
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readCoverImage(f).then((url) => url && setField('cover', url))
            e.target.value = ''
          }}
        />

        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <label className="text-[11.5px] text-[var(--ink-text-muted)] mb-1 block font-medium">书名 *</label>
            <input
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && onSave(form)}
              placeholder="请输入作品名称"
              autoFocus
              className="w-full text-[13px] px-3 py-2 rounded-xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
            />
          </div>

          <div>
            <label className="text-[11.5px] text-[var(--ink-text-muted)] mb-1 block font-medium">题材类型</label>
            <input
              value={form.genre}
              onChange={(e) => setField('genre', e.target.value)}
              placeholder="如：仙侠修真、东方玄幻、都市异能、科幻未来"
              className="w-full text-[12.5px] px-3 py-1.5 rounded-xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)]"
            />
          </div>

          <div>
            <label className="text-[11.5px] text-[var(--ink-text-muted)] mb-1 block font-medium">作品简介 / 大纲梗概</label>
            <textarea
              value={form.intro}
              onChange={(e) => setField('intro', e.target.value)}
              rows={3}
              placeholder="写下本书的核心看点、故事主旨或一句话大纲..."
              className="w-full text-[12px] px-3 py-2 rounded-xl bg-[var(--ink-bg-panel)] border border-[var(--ink-border)] text-[var(--ink-text)] focus:outline-none focus:border-[var(--ink-accent)] resize-none leading-relaxed"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 justify-end border-t border-[var(--ink-border)] pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 h-8 text-[12px] text-[var(--ink-text-muted)] hover:text-[var(--ink-text)] border border-[var(--ink-border)] rounded-xl hover:bg-[var(--ink-bg-hover)] transition-colors cursor-pointer"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          className="px-4 h-8 rounded-xl bg-[var(--ink-accent)] text-white text-[12px] font-medium flex items-center gap-1.5 hover:bg-[var(--ink-accent-hover)] transition-colors cursor-pointer shadow-xs"
        >
          <Check size={13} /> 保存作品信息
        </button>
      </div>
    </div>
  )
}
