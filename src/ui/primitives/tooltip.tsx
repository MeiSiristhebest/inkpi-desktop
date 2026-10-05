import {
  cloneElement,
  createElement,
  isValidElement,
  useCallback,
  useId,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

export type TooltipProps = Omit<TooltipPrimitive.Root.Props, 'children'> & {
  /** 提示正文；为空时不生成气泡，触发器原样返回。 */
  content: ReactNode
  side?: TooltipPrimitive.Positioner.Props['side']
  align?: TooltipPrimitive.Positioner.Props['align']
  className?: string
  children: ReactNode
}

type TriggerProps = {
  'aria-label'?: unknown
  'aria-describedby'?: unknown
  ref?: unknown
}

/** 保留触发器原有的 ref 写法（回调或对象），再挂上自己的测量节点。 */
function composeRef(existing: unknown, next: (node: HTMLElement | null) => void) {
  return (node: HTMLElement | null) => {
    next(node)
    if (typeof existing === 'function') (existing as (n: HTMLElement | null) => void)(node)
    else if (existing && typeof existing === 'object')
      (existing as { current: HTMLElement | null }).current = node
  }
}

/**
 * InkPi 提示门面：调用点只写 `<Tooltip content="…">触发器</Tooltip>`，
 * Base UI 的 Root/Trigger/Portal/Positioner/Popup 五层都由这里承担。
 *
 * 门面补的两件事都是引擎这一版没有的，也正是把原生 `title=` 迁走后会掉的东西：
 * 1. 1.8.0 的 Tooltip 气泡是 role=presentation 且不写 aria-describedby（产物里搜不到该属性），
 *    所以气泡与触发器的关联在这里自己接上。关联只在打开时存在——关闭态补隐藏节点会把每条
 *    提示文字永久留在 DOM 里，全站 getByText 会因此撞车；可聚焦的触发器本来就因焦点而打开，
 *    读屏拿到的时机与原生 title 的差别只剩「不悬停时不播报描述」；
 * 2. 图标按钮此前只有 title，删掉 title 就没名字了。补名只看量出来的结果：
 *    触发器渲染后没有可见文字才用 content 当 aria-label。有文字时文字就是名字，
 *    这跟原生 title 一致（title 只在缺少其它名称时兜底），覆盖它会违反 label-in-name。
 */
function Tooltip({
  content,
  side = 'top',
  align = 'center',
  className,
  children,
  onOpenChange,
  ...props
}: TooltipProps) {
  const element = isValidElement(children) ? (children as ReactElement<TriggerProps>) : null
  const own = (element?.props ?? {}) as TriggerProps

  const popupId = useId()
  const [open, setOpen] = useState(false)
  const [iconOnly, setIconOnly] = useState(false)

  const setTriggerNode = useCallback((node: HTMLElement | null) => {
    if (node) setIconOnly(!(node.textContent ?? '').trim())
  }, [])
  const ref = useMemo(() => composeRef(own.ref, setTriggerNode), [own.ref, setTriggerNode])

  if (content === undefined || content === null || content === '') return <>{children}</>

  const base = element ?? createElement('span', null, children)
  const named = typeof content === 'string' && typeof own['aria-label'] !== 'string' && iconOnly

  const trigger = cloneElement(base, {
    ...(named ? { 'aria-label': content } : null),
    'aria-describedby': open ? popupId : undefined,
    ref,
  })

  return (
    <TooltipPrimitive.Root
      {...props}
      onOpenChange={(next, details) => {
        // 提示气泡不是模态层。useDismiss 的默认值是 escapeKey=true、bubbles=false，
        // 于是它关闭时会 stopPropagation —— 而浮层初始聚焦会顺手把焦点提示打开，
        // Esc 就被气泡吃掉、再也交不到对话框的 useOverlayFocus。这里放行传播，
        // 让「气泡自己关掉」和「外层浮层也收到同一个 Esc」同时成立。
        // 'escape-key' 即 internals/reason-parts 里的 REASONS.escapeKey。
        if (!next && details.reason === 'escape-key') details.allowPropagation()
        setOpen(next)
        onOpenChange?.(next, details)
      }}
    >
      <TooltipPrimitive.Trigger render={trigger} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner align={align} side={side} className="isolate z-50">
          <TooltipPrimitive.Popup
            id={popupId}
            data-slot="tooltip-content"
            className={cn(
              'z-50 inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1.5 text-xs leading-relaxed text-background shadow-md',
              className,
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

/** 挂在应用根部一次即可，负责全局悬停/焦点延迟。引擎这一层不产出 DOM，所以没有 className 入口。 */
function TooltipProvider({ delay = 300, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider delay={delay} {...props} />
}

export { Tooltip, TooltipProvider }
