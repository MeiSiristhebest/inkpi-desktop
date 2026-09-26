import { Children, isValidElement, type ReactNode } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SelectOption = {
  value: string
  label: ReactNode
  disabled?: boolean
}

export type SelectProps = {
  /** 受控值。`''` 表示"未选择"并显示 `placeholder`；引擎据此把它折成 null，两侧对称。 */
  value: string
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
  className?: string
  id?: string
  name?: string
}

const TRIGGER =
  'inline-flex h-8 max-w-full items-center justify-between gap-1.5 rounded-lg border border-border ' +
  'bg-background py-1 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none ' +
  'hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 data-placeholder:text-muted-foreground ' +
  '[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4'

const POPUP =
  'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 ' +
  'origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover ' +
  'text-popover-foreground shadow-md ring-1 ring-foreground/10'

const ITEM =
  'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm ' +
  'outline-hidden select-none focus:bg-accent focus:text-accent-foreground ' +
  'data-disabled:pointer-events-none data-disabled:opacity-50'

/** 从原生 `<option value label>` 子节点取出选项表，让迁移约等于换个标签名。 */
function optionsFromChildren(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== 'option') continue
    const {
      value,
      disabled,
      children: label,
    } = child.props as {
      value?: string | number
      disabled?: boolean
      children?: ReactNode
    }
    out.push({ value: String(value ?? ''), label, disabled: Boolean(disabled) })
  }
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
  className,
  id,
  name,
}: SelectProps) {
  const items = options ?? optionsFromChildren(children)
  const labels: Record<string, ReactNode> = {}
  for (const item of items) labels[item.value] = item.label

  return (
    <SelectPrimitive.Root
      id={id}
      name={name}
      value={value === '' ? null : value}
      disabled={disabled}
      items={labels}
      onValueChange={(next) => onValueChange(next ?? '')}
    >
      <SelectPrimitive.Trigger
        data-slot="select-trigger"
        aria-label={ariaLabel}
        className={cn(TRIGGER, className)}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon render={<ChevronDownIcon />} />
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          align="start"
          sideOffset={4}
          className="isolate z-50 outline-none"
        >
          <SelectPrimitive.Popup data-slot="select-content" className={POPUP}>
            <SelectPrimitive.List className="scroll-my-1 p-1 outline-none">
              {items.map((item) => (
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
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export { Select }
