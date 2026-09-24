import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { Combobox } from '@base-ui/react/combobox'
import { Select } from '@base-ui/react/select'

/**
 * 中文输入法 composition 契约测试。
 *
 * 这里用合成事件复现拼音输入的真实事件序列（compositionstart → 若干 input →
 * compositionend），用来判断行为底座在「组词还没结束」时会不会把输入框的值改掉、
 * 会不会提前过滤选项导致误显「无结果」。
 *
 * 注意边界：本测试只能验证库的事件处理，验证不了 tauri#15436 那种
 * WebView2/TSF 层的原生冻结——那必须在真实 Windows 上用真输入法跑。
 */

const ITEMS = ['红楼梦', '红楼梦判词', '红拂', '人物志', '写作手法']

function ControlledInput({ label }: { label: string }) {
  return <input aria-label={label} defaultValue="" />
}

function ThemeCombobox() {
  return (
    <Combobox.Root items={ITEMS}>
      <Combobox.Input aria-label="检索主题" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.Empty>没有匹配的主题</Combobox.Empty>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/** 把一段拼音「打字」过程完整跑完：候选串先以组字状态出现，确认后才落到输入框。 */
function typeWithPinyin(input: HTMLElement, preedit: string, final: string) {
  fireEvent.compositionStart(input, { data: '' })
  fireEvent.input(input, { target: { value: preedit } })
  fireEvent.compositionUpdate(input, { data: preedit })
  fireEvent.input(input, { target: { value: final } })
  fireEvent.compositionEnd(input, { data: final })
}

function compositionInProgress(input: HTMLElement, preedit: string) {
  fireEvent.compositionStart(input, { data: '' })
  fireEvent.input(input, { target: { value: preedit } })
  fireEvent.compositionUpdate(input, { data: preedit })
}

afterEach(cleanup)

describe('中文 composition 契约', () => {
  it('原生受控输入在完整拼音序列后保留组字结果', () => {
    render(<ControlledInput label="标题" />)
    const input = screen.getByRole('textbox', { name: '标题' })
    typeWithPinyin(input, 'hong', '红')
    expect(input).toHaveValue('红')
  })

  it('组字过程中不提前过滤选项（否则「无结果」会误显）', () => {
    render(<ThemeCombobox />)
    const input = screen.getByRole('combobox', { name: '检索主题' })
    input.focus()

    act(() => {
      compositionInProgress(input, 'hong')
    })

    expect(screen.queryByText('没有匹配的主题')).toBeNull()
    expect(input).toHaveValue('hong')
  })

  it('compositionend 之后才按最终汉字过滤', () => {
    render(<ThemeCombobox />)
    const input = screen.getByRole('combobox', { name: '检索主题' })
    input.focus()

    act(() => {
      typeWithPinyin(input, 'hong', '红')
    })

    expect(input).toHaveValue('红')
    const options = screen.queryAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options.map((o) => o.textContent)).toEqual(['红楼梦', '红楼梦判词', '红拂'])
  })

  it('已知缺陷锁：组字未结束时用鼠标点条目，拼音残串会留在输入框', () => {
    render(<ThemeCombobox />)
    const input = screen.getByRole('combobox', { name: '检索主题' })
    input.focus()

    act(() => {
      compositionInProgress(input, 'hong')
    })

    const target = screen.getByRole('option', { name: '人物志' })
    act(() => {
      fireEvent.mouseDown(target)
      fireEvent.click(target)
    })
    // 真实输入法里鼠标点选常发生在 compositionend 之前或同时。
    act(() => {
      fireEvent.compositionEnd(input, { data: 'hong' })
    })

    // 断言的是「当前实测到的错误行为」，正确行为应为输入框只留下被选中的条目文本、
    // 不含未确认的候选串：expect(value).not.toMatch(/hong/)。
    // 上游缺陷 mui/base-ui#5574（2026-09-25 实测仍复现）。
    // 这条用例是缺陷锁：上游一旦修好它会变红，届时才能解除「CJK 自由文本下拉不用
    // Base UI Combobox」的限制，改为直接用它。
    expect((input as HTMLInputElement).value).toBe('hong')
  })
})

describe('Select 的键盘 typeahead 与拼音', () => {
  const OPTIONS = ITEMS.map((label) => ({ label, value: label }))

  function FontSelect() {
    return (
      <Select.Root items={OPTIONS}>
        <Select.Trigger aria-label="正文字体">
          <Select.Value placeholder="未选择" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.List>
                {OPTIONS.map(({ label, value }) => (
                  <Select.Item key={value} value={value}>
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    )
  }

  it('打开面板后按拼音字母不应直接改值（typeahead 只移动高亮）', () => {
    render(<FontSelect />)
    const trigger = screen.getByRole('combobox', { name: '正文字体' })
    fireEvent.click(trigger)

    // 中文输入法组字时 keydown.key 通常是 'Process'（keyCode 229），
    // 但部分第三方输入法/候选模式会先吐出原始字母。
    act(() => {
      fireEvent.compositionStart(trigger, { data: '' })
      for (const k of ['h', 'o', 'n', 'g']) {
        fireEvent.keyDown(trigger, { key: k, code: `Key${k.toUpperCase()}` })
      }
      fireEvent.keyDown(trigger, { key: 'Process', keyCode: 229 })
      fireEvent.compositionEnd(trigger, { data: '红' })
    })

    expect(trigger).toHaveTextContent('未选择')
  })

  it('正向对照：完整指针序列能把条目选进值里', () => {
    render(<FontSelect />)
    const trigger = screen.getByRole('combobox', { name: '正文字体' })
    fireEvent.click(trigger)

    const option = screen.getByRole('option', { name: '红拂' })
    act(() => {
      fireEvent.pointerDown(option)
      fireEvent.pointerUp(option)
      fireEvent.mouseDown(option)
      fireEvent.mouseUp(option)
      fireEvent.click(option)
    })

    expect(trigger).toHaveTextContent('红拂')
  })
})
