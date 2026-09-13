import React, { useState, useRef, useEffect } from 'react'
import { Check, Plus } from 'lucide-react'
import { Modal } from '../../../ui/molecules/Modal'
import { localStorageKeyValueStore } from '../../../adapters/localStorageKeyValueStore'
import { useSettings } from '../../../core/settings'

export type GridLineType = 'none' | 'solid' | 'dashed'

export interface EditorBackgroundConfig {
  themeMode: 'light' | 'dark'
  skinId: string
  gridType: GridLineType
  customBgImage?: string
}

export interface BackgroundModalProps {
  onClose: () => void
  config: EditorBackgroundConfig
  onChange: (cfg: EditorBackgroundConfig) => void
}

// 预设专业写作阅读皮肤底色（覆盖 3 款浅色护眼 + 3 款深色夜读）
export const PRESET_SKINS = [
  // 浅色护眼阵营 (Light)
  {
    id: 'default',
    name: '石墨白',
    bg: '#ffffff',
    border: '#e9e9e7',
    darkBg: '#191919',
    textCol: '#37352f',
    darkTextCol: '#e9e9e7',
  },
  {
    id: 'classic-yellow',
    name: '羊皮纸',
    bg: '#f9f5eb',
    border: '#ded4c1',
    darkBg: '#181b22',
    textCol: '#342e28',
    darkTextCol: '#e2e8f0',
  },
  {
    id: 'eye-green',
    name: '春苔绿',
    bg: '#eef3eb',
    border: '#cbd5c5',
    darkBg: '#141a16',
    textCol: '#2d3748',
    darkTextCol: '#e2ede5',
  },
  {
    id: 'mist-gray',
    name: '薄雾灰',
    bg: '#f7f7f8',
    border: '#e2e8f0',
    darkBg: '#191919',
    textCol: '#37352f',
    darkTextCol: '#e9e9e7',
  },

  // 深色沉浸阵营 (Dark)
  {
    id: 'dark',
    name: '黑曜石',
    bg: '#ffffff',
    border: '#2f2f2f',
    darkBg: '#191919',
    textCol: '#37352f',
    darkTextCol: '#e9e9e7',
  },
  {
    id: 'midnight',
    name: '夜读深渊',
    bg: '#f9f5eb',
    border: '#242c3b',
    darkBg: '#11141a',
    textCol: '#342e28',
    darkTextCol: '#e2e8f0',
  },
  {
    id: 'forest',
    name: '松柏森夜',
    bg: '#eef3eb',
    border: '#28342c',
    darkBg: '#141a16',
    textCol: '#2d3748',
    darkTextCol: '#e2ede5',
  },
  {
    id: 'green-mountain',
    name: '绿水青山',
    bg: '#eef7f2',
    border: '#b8dfcc',
    darkBg: '#112219',
    textCol: '#1a2e22',
    darkTextCol: '#d1fae5',
  },
]

export const BackgroundModal: React.FC<BackgroundModalProps> = ({ onClose, config, onChange }) => {
  const [settings, updateSettings] = useSettings()
  const isGlobalDark =
    settings.themeMode === 'dark' ||
    (settings.themeMode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(isGlobalDark ? 'dark' : 'light')
  const [skinId, setSkinId] = useState(config.skinId || 'mist-gray')
  const [gridType, setGridType] = useState<GridLineType>(config.gridType || 'none')
  const [customBgImage, setCustomBgImage] = useState<string | undefined>(config.customBgImage)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setThemeMode(isGlobalDark ? 'dark' : 'light')
  }, [isGlobalDark])

  const applyChange = (patch: Partial<EditorBackgroundConfig>) => {
    const next: EditorBackgroundConfig = {
      themeMode,
      skinId,
      gridType,
      customBgImage,
      ...patch,
    }
    if (patch.themeMode !== undefined) {
      setThemeMode(patch.themeMode)
      // 联动同步更新全局设置的外观模式，让背景与所有系统面板同频进入深色模式
      updateSettings({ themeMode: patch.themeMode })
    }
    if (patch.skinId !== undefined) setSkinId(patch.skinId)
    if (patch.gridType !== undefined) setGridType(patch.gridType)
    if (patch.customBgImage !== undefined) setCustomBgImage(patch.customBgImage)

    onChange(next)
    void localStorageKeyValueStore.set('inkpi-editor-bg-config', JSON.stringify(next))
  }

  // 上传自定义背景图片
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('背景图片请控制在 5MB 以内')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result)
      applyChange({ customBgImage: dataUrl, skinId: 'custom' })
    }
    reader.readAsDataURL(file)
  }

  return (
    <Modal
      onClose={onClose}
      widthClass="max-w-[340px]"
      overlayClassName="bg-black/30 backdrop-blur-xs"
      panelClassName="bg-[var(--ink-bg-elevated)] border border-[var(--ink-border)] rounded-2xl shadow-2xl p-5 text-[var(--ink-text)] font-sans select-none flex flex-col gap-4"
    >
      {/* 1. 深色模式切换 */}
      <div className="flex items-center justify-between py-1">
        <span className="text-[13.5px] font-medium text-[var(--ink-text)]">深色模式</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={themeMode === 'dark'}
            onChange={(e) => applyChange({ themeMode: e.target.checked ? 'dark' : 'light' })}
            className="sr-only peer"
          />
          <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[var(--ink-accent)] dark:bg-gray-700" />
        </label>
      </div>

      <div className="border-t border-[var(--ink-border)]/70" />

      {/* 2. 皮肤与背景颜色 */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[var(--ink-text)]">
            {themeMode === 'dark' ? '深色皮肤' : '浅色皮肤'}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[12px] font-medium text-[var(--ink-accent)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>自定义</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadImage}
          />
        </div>

        {/* 艺术宣传条 / 快捷栏 */}
        <div className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/60 dark:border-emerald-900/40 px-3 flex items-center justify-between text-[12px] text-emerald-900 dark:text-emerald-200 font-medium shadow-2xs">
          <span>绿水青山 · 雅致书卷</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
            推荐
          </span>
        </div>

        {/* 预设色块矩阵 */}
        <div className="grid grid-cols-4 gap-2.5 pt-1">
          {PRESET_SKINS.map((s) => {
            const isSelected = skinId === s.id && !customBgImage
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => applyChange({ skinId: s.id, customBgImage: undefined })}
                className="flex flex-col items-center gap-1 cursor-pointer group"
              >
                <div
                  style={{ backgroundColor: themeMode === 'dark' ? s.darkBg : s.bg }}
                  className={`w-14 h-10 rounded-lg border transition-all flex items-center justify-center ${
                    isSelected
                      ? 'border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]/30 shadow-xs'
                      : 'border-gray-200 dark:border-gray-700 hover:scale-105'
                  }`}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-[var(--ink-accent)] stroke-[2.5]" />
                  )}
                </div>
                <span className="text-[11px] text-[var(--ink-text-muted)] group-hover:text-[var(--ink-text)] truncate max-w-full">
                  {s.name}
                </span>
              </button>
            )
          })}

          {/* 如果有自定义上传图片 */}
          {customBgImage && (
            <button
              type="button"
              onClick={() => applyChange({ skinId: 'custom' })}
              className="flex flex-col items-center gap-1 cursor-pointer group col-span-4"
            >
              <div
                style={{ backgroundImage: `url(${customBgImage})`, backgroundSize: 'cover' }}
                className="w-full h-10 rounded-lg border border-[var(--ink-accent)] ring-2 ring-[var(--ink-accent)]/30 flex items-center justify-center shadow-xs"
              >
                <Check className="w-4 h-4 text-white drop-shadow-md stroke-[2.5]" />
              </div>
              <span className="text-[11px] text-[var(--ink-accent)] font-medium truncate">
                已应用自定义壁纸
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--ink-border)]/70" />

      {/* 3. 网格线选项 */}
      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-[var(--ink-text)] block">网格线</span>
        <div className="grid grid-cols-3 gap-3">
          {/* 无网格 */}
          <button
            type="button"
            onClick={() => applyChange({ gridType: 'none' })}
            className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all cursor-pointer ${
              gridType === 'none'
                ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] shadow-xs'
                : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-border-strong)]'
            }`}
          >
            <div className="w-10 h-7 relative rounded border border-gray-300/80 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-800">
              <svg className="w-full h-full" viewBox="0 0 40 28">
                <line x1="0" y1="28" x2="40" y2="0" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className="text-[11.5px] font-medium">无</span>
          </button>

          {/* 实线网格 */}
          <button
            type="button"
            onClick={() => applyChange({ gridType: 'solid' })}
            className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all cursor-pointer ${
              gridType === 'solid'
                ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] shadow-xs'
                : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-border-strong)]'
            }`}
          >
            <div className="w-10 h-7 rounded border border-gray-300/80 dark:border-gray-600 flex flex-col justify-around py-1 px-1 bg-white dark:bg-gray-800">
              <div className="w-full h-px bg-gray-400 dark:bg-gray-500" />
              <div className="w-full h-px bg-gray-400 dark:bg-gray-500" />
              <div className="w-full h-px bg-gray-400 dark:bg-gray-500" />
            </div>
            <span className="text-[11.5px] font-medium">实线</span>
          </button>

          {/* 虚线网格 */}
          <button
            type="button"
            onClick={() => applyChange({ gridType: 'dashed' })}
            className={`flex flex-col items-center gap-1.5 py-2 rounded-xl border transition-all cursor-pointer ${
              gridType === 'dashed'
                ? 'border-[var(--ink-accent)] bg-[var(--ink-accent-soft)] text-[var(--ink-accent)] shadow-xs'
                : 'border-[var(--ink-border)] bg-[var(--ink-bg-card)] hover:border-[var(--ink-border-strong)]'
            }`}
          >
            <div className="w-10 h-7 rounded border border-gray-300/80 dark:border-gray-600 flex flex-col justify-around py-1 px-1 bg-white dark:bg-gray-800">
              <div className="w-full h-px border-b border-dashed border-gray-400 dark:bg-gray-500" />
              <div className="w-full h-px border-b border-dashed border-gray-400 dark:bg-gray-500" />
              <div className="w-full h-px border-b border-dashed border-gray-400 dark:bg-gray-500" />
            </div>
            <span className="text-[11.5px] font-medium">虚线</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
