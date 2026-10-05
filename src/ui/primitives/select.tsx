import { Children, isValidElement, type ReactNode } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
  /** 分组标题；来自原生 `<optgroup label>`，同组的连续项会渲染成一个 Select.Group。 */
  group?: string
}

export type SelectProps = {
  /**
   * 受控值。数字也收：原生 `<select>` 本来就靠字符串化工作，被替换的调用点里有 8 处传的是数字。
   * `''` 一律表示"未选择"并显示 `placeholder`（引擎把无值折成 null，这里两侧对称）。
   */
  value: string | number
  onValueChange: (value: string) => void
  /**
   * 选项来源二选一：`options` 数组，或直接写原生 `<option>` 子节点。
   * 两种都收是因为现存 52 个 `<select>` 里 29 个用 `.map()`、23 个写死子节点；
   * 只支持前者就会逼着那 23 处先改成数组，那是纯粹的迁移税。
   */
  options?: readonly SelectOption[]
  children?: ReactNode
  'aria-label'?: string
  placeholder?: ReactNode
  disabled?: boolean
  /** 密度：`sm` 给工具栏/插件筛选条，`default` 给表单。 */
  size?: keyof typeof SIZE
  className?: string
  id?: string
  name?: string
}

const TRIGGER =
  'inline-flex max-w-full items-center justify-between gap-1.5 rounded-lg border border-border ' +
  'bg-background whitespace-nowrap transition-colors outline-none select-none ' +
  'hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground ' +
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4'

/**
 * 两档密度而不是让调用点各写一行皮肤：被替换的 47 个 className 里 35 个只是把
 * 控件压到 text-xs / py-1 的密排尺寸，那是一根真实的密度轴，不是个性化样式。
 */
const SIZE = {
  default: 'h-8 px-2.5 text-sm',
  sm: 'h-7 px-2 text-xs',
} as const

const POPUP =
  'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 ' +
  'origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover ' +
  'text-popover-foreground shadow-md ring-1 ring-foreground/10'

const ITEM =
  'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm ' +
  'outline-hidden select-none focus:bg-accent focus:text-accent-foreground ' +
  'data-disabled:pointer-events-none data-disabled:opacity-50'

/** 从原生 `<option>` / `<optgroup>` 子节点取出选项表，让迁移约等于换个标签名。 */
function optionsFromChildren(children: ReactNode, group?: string): SelectOption[] {
  const out: SelectOption[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    if (child.type === 'optgroup') {
      const { label, children: inner } = child.props as {
        label?: string
        children?: ReactNode
      }
      out.push(...optionsFromChildren(inner, String(label ?? '')))
      continue
    }
    if (child.type !== 'option') continue
    const {
      value,
      disabled,
      children: label,
    } = child.props as {
      value?: string | number
      disabled?: boolean
      children?: ReactNode
    }
    out.push({ value: String(value ?? ''), label, disabled: Boolean(disabled), group })
  }
  return out
}

/** 连续同组的项收进一个 Select.Group；无组的项直接铺平。 */
function renderItems(items: readonly SelectOption[]) {
  const row = (item: SelectOption) => (
    <SelectPrimitive.Item
      key={item.value}
      data-slot="select-item"
      value={item.value}
      disabled={item.disabled}
      className={ITEM}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {item.label}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )

  const out: ReactNode[] = []
  let open: { group: string; rows: SelectOption[] } | null = null
  const flush = () => {
    if (!open) return
    out.push(
      <SelectPrimitive.Group key={`g:${open.group}:${open.rows[0].value}`}>
        <SelectPrimitive.GroupLabel className="px-1.5 py-1 text-xs text-muted-foreground">
          {open.group}
        </SelectPrimitive.GroupLabel>
        {open.rows.map(row)}
      </SelectPrimitive.Group>,
    )
    open = null
  }
  for (const item of items) {
    if (item.group === undefined) {
      flush()
      out.push(row(item))
    } else {
      if (!open || open.group !== item.group) {
        flush()
        open = { group: item.group, rows: [] }
      }
      open.rows.push(item)
    }
  }
  flush()
  return out
}

function Select({
  value,
  onValueChange,
  options,
  children,
  'aria-label': ariaLabel,
  placeholder,
  disabled,
  size = 'default',
  className,
  id,
  name,
}: SelectProps) {
  const items = options ?? optionsFromChildren(children)
  const labels: Record<string, ReactNode> = {}
  for (const item of items) labels[item.value] = item.label
  const selected = String(value)

  return (
    <SelectPrimitive.Root
      id={id}
      name={name}
      value={selected === '' ? null : selected}
      disabled={disabled}
      items={labels}
      onValueChange={(next) => onValueChange(next ?? '')}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        data-value={selected}
        aria-label={ariaLabel}
        className={cn(TRIGGER, SIZE[size], className)}
      >
        <SelectPrimitive.Value
          placeholder={placeholder}
          className="min-w-0 flex-1 truncate text-left"
        />
        <SelectPrimitive.Icon render={<ChevronDownIcon />} />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          align="start"
          alignItemWithTrigger={false}
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <SelectPrimitive.Popup data-slot="select-content" className={POPUP}>
            <SelectPrimitive.List className="scroll-my-1 p-1 outline-none">
              {renderItems(items)}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
