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

    // 自动联动适配：深浅模式与皮肤系统无缝协同
    let effectiveSkin = settings.themeSkin
    const isDark =
      settings.themeMode === 'dark' ||
      (settings.themeMode === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-color-scheme: dark)').matches)

    // 若系统进入深色模式，浅色皮肤自动平滑升阶为对应的一线深色沉浸皮肤
    if (isDark) {
      if (effectiveSkin === 'default') effectiveSkin = 'dark'
      else if (effectiveSkin === 'sepia' || effectiveSkin === 'ink') effectiveSkin = 'forest'
      else if (effectiveSkin === 'sage' || effectiveSkin === 'youth') effectiveSkin = 'forest'
    } else {
      // 若系统进入浅色模式，深色皮肤自动平滑回退为对应的一线浅色护眼皮肤
      if (effectiveSkin === 'dark') effectiveSkin = 'default'
      else if (effectiveSkin === 'midnight') effectiveSkin = 'default'
      else if (effectiveSkin === 'forest') effectiveSkin = 'sage'
    }

    root.setAttribute('data-skin', effectiveSkin)

    // 全局界面缩放：设置 root fontSize，使基于 rem 的 UI 元素（侧栏、顶栏、按钮）等比缩放
    const uiSize = settings.uiFontSize || 13
    root.style.fontSize = `${uiSize}px`
    root.style.setProperty('--ink-ui-font-size', `${uiSize}px`)
  }, [settings.themeMode, settings.themeSkin, settings.uiFontSize])

  return null
}
