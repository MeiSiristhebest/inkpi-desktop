import { useEffect, type FC } from 'react'
import { useSettings } from './settings'

/**
 * 主题副作用边界：把「写 document.documentElement[data-theme/data-skin]」这一唯一 DOM 副作用
 * 从 useSettings 抽到此处，作为全局单一副作用边界。视图层与设置状态本身不再触碰 document。
 */
export const ThemeController: FC = () => {
  const [settings] = useSettings()

  useEffect(() => {
    const root = document.documentElement
    if (settings.themeMode === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.themeMode)
    root.setAttribute('data-skin', settings.themeSkin)

    // 全局界面缩放：设置 root fontSize，使基于 rem 的 UI 元素（侧栏、顶栏、按钮）等比缩放
    const uiSize = settings.uiFontSize || 13
    root.style.fontSize = `${uiSize}px`
    root.style.setProperty('--ink-ui-font-size', `${uiSize}px`)
  }, [settings.themeMode, settings.themeSkin, settings.uiFontSize])

  return null
}
