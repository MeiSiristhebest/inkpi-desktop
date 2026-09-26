import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

export type TooltipProps = Omit<TooltipPrimitive.Root.Props, 'children'> & {
  /** 提示正文；字符串时同时用来补触发器的可访问名称。 */
  content: ReactNode
  side?: TooltipPrimitive.Positioner.Props['side']
  align?: TooltipPrimitive.Positioner.Props['align']
  className?: string
  children: ReactNode
}

type TriggerProps = {
  'aria-label'?: unknown
  'aria-describedby'?: unknown
  title?: unknown
  children?: unknown
}

/** 只有纯图标触发器才补名：已有可见文字或 aria-label 的一律不覆盖。 */
function needsName(child: ReactElement<TriggerProps>): boolean {
  const { 'aria-label': label, children } = child.props
  return typeof label !== 'string' && typeof children !== 'string' && typeof children !== 'number'
}

/**
 * InkPi 提示门面：调用点只写 `<Tooltip content="…">触发器</Tooltip>`，
 * Base UI 的 Root/Trigger/Portal/Positioner/Popup 五层都由这里承担。
 *
 * 门面补的两件事都是引擎这一版没有的，也正是把原生 `title=` 迁走后会掉的东西：
 * 1. 1.8.0 的 Tooltip 气泡是 role=presentation 且不写 aria-describedby（产物里搜不到该属性），
 *    所以气泡与触发器的关联在这里自己接上；
 * 2. 图标按钮此前只有 title，删掉 title 就没名字了，所以字符串 content 自动补成 aria-label。
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
  const popupId = useId()
  const [open, setOpen] = useState(false)

  const element = isValidElement(children) ? (children as ReactElement<TriggerProps>) : null
  const base = element ?? <span>{children}</span>
  const trigger = cloneElement(base, {
    ...(element && needsName(element) && typeof content === 'string'
      ? { 'aria-label': content }
      : null),
    'aria-describedby': open ? popupId : undefined,
  })

  return (
    <TooltipPrimitive.Root
      {...props}
      onOpenChange={(next, details) => {
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
