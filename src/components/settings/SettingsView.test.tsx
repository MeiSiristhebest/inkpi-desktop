import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { SettingsView } from './SettingsView'
import { SettingsProvider } from '../../core/settings'
import { ThemeController } from '../../core/ThemeController'
import { db } from '../../db/indexedDB'

// 与 App 一致的装配：SettingsProvider 提供设置单一来源，ThemeController 负责把主题副作用写到 <html data-theme>。
// 仅渲染 SettingsView 本身不会触发 data-theme 写入（副作用已隔离到 ThemeController）。
const renderSettings = (
  props: { open: boolean; onClose: () => void } & Partial<{
    runtimeState: 'online' | 'connecting' | 'offline' | 'unknown'
    onReconnect: () => void
  }>,
) =>
  render(
    <SettingsProvider>
      <ThemeController />
      <SettingsView open={props.open} onClose={props.onClose} {...props} />
    </SettingsProvider>,
  )

const readStored = () => JSON.parse(localStorage.getItem('inkpi-settings') || '{}')

// 与读屏器一致的兜底算法：显式 aria-label > aria-labelledby 指向的文本 > 包裹式 label >
// label[for] 关联。只断言「视觉上有相邻文字」不算通过，那正是 P4.4 点名的反例。
const accessibleName = (el: Element): string => {
  const direct = el.getAttribute('aria-label')
  if (direct) return direct.trim()
  const byId = el.getAttribute('aria-labelledby')
  if (byId) {
    const text = byId
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim()
    if (text) return text
  }
  const wrapper = el.closest('label')
  if (wrapper?.textContent?.trim()) return wrapper.textContent.trim()
  const elId = el.getAttribute('id')
  if (elId) {
    // 逐个比对而不是拼选择器：useId 生成的 id 含冒号，拼进 querySelector 会抛语法错
    for (const lab of Array.from(document.querySelectorAll('label[for]'))) {
      if (lab.getAttribute('for') === elId && lab.textContent?.trim()) return lab.textContent.trim()
    }
  }
  return ''
}

beforeEach(async () => {
  localStorage.clear()
  // 清空 IDB 镜像，避免跨测试串扰
  try {
    await db.delete('settings', 'app')
  } catch {
    /* ignore */
  }
})

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('SettingsView', () => {
  it('外观：切换深色主题会应用到 <html data-theme> 并持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('深色'))
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('dark'))
    await waitFor(() => expect(readStored().themeMode).toBe('dark'))
  })

  it('编辑器：切换字体族与行距会持久化', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('编辑器'))
    fireEvent.click(screen.getByText('黑体'))
    fireEvent.click(screen.getByText('1.6'))
    await waitFor(() => {
      const s = readStored()
      expect(s.fontFamily).toBe('sans')
      expect(s.lineHeight).toBe('1.6')
    })
  })

  it('自定义 AI：通过「添加服务」选择 provider 并手动填写模型 ID，保存后写入 aiModel', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    // 点击「添加服务」
    fireEvent.click(screen.getByText('添加服务'))

    // 选择 DeepSeek 厂商并填写模型 ID
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'deepseek' } })

    // 添加模型 ID
    fireEvent.change(screen.getByPlaceholderText('输入模型 ID，如 my-model-v2'), {
      target: { value: 'deepseek-chat' },
    })
    fireEvent.click(screen.getByText('添加'))

    fireEvent.click(screen.getByText('保存服务'))
    await waitFor(() => {
      const s = readStored()
      expect(s.aiModel?.provider).toBe('deepseek')
      expect(s.aiModel?.id).toBe('deepseek-chat')
    })
  })

  it('自定义 AI：切换 provider 会自动填入该提供方默认 Base URL', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('自定义 AI 模型'))

    fireEvent.click(screen.getByText('添加服务'))

    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'deepseek' } })

    await waitFor(() =>
      expect(screen.getByDisplayValue('https://api.deepseek.com/v1')).toBeInTheDocument(),
    )
  })

  it('高级：修改 Daemon 地址会持久化（P3.13 从「连接」里分出来的）', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('高级'))
    expect(screen.getByLabelText('Daemon WebSocket 地址')).toBeInTheDocument()
    const input = screen.getByPlaceholderText('ws://127.0.0.1:8849')
    fireEvent.change(input, { target: { value: 'ws://127.0.0.1:9999' } })
    await waitFor(() => expect(readStored().daemonWsUrl).toBe('ws://127.0.0.1:9999'))
  })

  it('连接页只讲三项状态：自建地址与数据存储不再混在这里（P3.13）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('连接'))

    expect(screen.getByText('系统运行状态')).toBeInTheDocument()
    expect(screen.queryByLabelText('Daemon WebSocket 地址')).not.toBeInTheDocument()
    expect(screen.queryByText('本地数据存储')).not.toBeInTheDocument()
  })

  it('隐私与数据：按真实落点分别说明正文、设置与密钥存在哪里（P3.13）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('隐私与数据'))

    expect(screen.getByText('正文、章节与设定')).toBeInTheDocument()
    expect(screen.getByText('应用设置')).toBeInTheDocument()
    expect(screen.getByText('模型 API 密钥')).toBeInTheDocument()
    expect(screen.getByText(/操作系统凭据管理器/)).toBeInTheDocument()
  })

  it('隐私与数据：只承诺实际行为，不承诺数据绝不离开设备（P3.15）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('隐私与数据'))

    expect(
      screen.getByText('使用外部 AI 模型时，为完成请求所需的上下文会发送给你选择的模型提供商。'),
    ).toBeInTheDocument()
    expect(screen.getByText(/最多附带最近 6 轮上文/)).toBeInTheDocument()
    // 反例锚点：这句话此前就在同一个段落里，而 AI 请求确实会把上下文交给外部提供商。
    expect(screen.queryByText(/绝不离开/)).not.toBeInTheDocument()
  })

  it('连接：三组状态各自独立，没接线时显示未知而不是绿色已就绪（P1.18）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('连接'))

    expect(screen.queryByText(/已就绪/)).not.toBeInTheDocument()
    expect(screen.getByText('未知')).toBeInTheDocument() // Runtime：宿主未透传状态
    expect(screen.getByText('未配置')).toBeInTheDocument() // AI：还没有绑定模型
    expect(screen.getByText('未检测')).toBeInTheDocument() // Provider：没发过真实请求
    expect(screen.getByRole('button', { name: '检测' })).toBeDisabled()
  })

  it('连接：请求被平台边界拦下时说「无法探测」，不谎报端点无法访问（P5.2 / INV-09）', async () => {
    localStorage.setItem(
      'inkpi-settings',
      JSON.stringify({
        aiModel: {
          id: 'deepseek-chat',
          name: 'DS',
          provider: 'deepseek',
          baseUrl: 'https://api.deepseek.com/v1',
        },
      }),
    )
    // 打包版 CSP 的 connect-src 只放行本机地址：渲染进程直连提供商端点必然拿不到回应。
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    try {
      renderSettings({ open: true, onClose: vi.fn() })
      fireEvent.click(screen.getByText('连接'))
      const probe = screen.getByRole('button', { name: '检测' })
      expect(probe).toBeEnabled()

      fireEvent.click(probe)

      await waitFor(() => expect(screen.getByText('无法探测')).toBeInTheDocument())
      expect(screen.getByText(/请求没有拿到端点回应/)).toBeInTheDocument()
      expect(screen.getByText(/AI 任务由 Runtime 进程发起/)).toBeInTheDocument()
      // 反例锚点：旧口径把这条报成端点故障。
      expect(screen.queryByText('无法访问')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('连接：Runtime 离线时如实说明后果，并给出重连入口', () => {
    const onReconnect = vi.fn()
    renderSettings({ open: true, onClose: vi.fn(), runtimeState: 'offline', onReconnect })
    fireEvent.click(screen.getByText('连接'))

    expect(screen.getByText('离线')).toBeInTheDocument()
    expect(screen.getByText(/Daemon 未运行/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重连' }))
    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('编辑器：切换段落缩进方式会持久化到 paragraphIndent', async () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('编辑器'))
    fireEvent.click(screen.getByText('两半角空格'))
    await waitFor(() => expect(readStored().paragraphIndent).toBe('space2'))
  })

  it('关于：把数据去向交给「隐私与数据」，自己只留版本与架构（P3.13）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('关于'))

    expect(screen.getByText('内置功能一览')).toBeInTheDocument()
    expect(screen.getByText('统一设置中心')).toBeInTheDocument()
    expect(screen.getByText('本地 IndexedDB')).toBeInTheDocument()
    expect(screen.queryByText(/为完成请求所需的上下文/)).not.toBeInTheDocument()
  })

  it('侧栏分成三层，而不是十个标签挤在同一个「功能偏好」下（P3.13）', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    expect(screen.getByText('功能偏好')).toBeInTheDocument()
    expect(screen.getByText('能力与连接')).toBeInTheDocument()
    expect(screen.getByText('系统')).toBeInTheDocument()
  })

  it('每个设置标签下的控件都能被读屏器念出名称（P4.4）', () => {
    const { container } = renderSettings({ open: true, onClose: vi.fn() })
    let visited = 0
    // 只覆盖真正承载表单控件的标签：快捷键/关于是只读清单，插件管理渲染的是动作按钮，
    // 三者都不含 input/select/switch，纳入门控只会变成空转断言。
    for (const tab of ['外观', '编辑器', '写作与习惯', '连接', '高级']) {
      fireEvent.click(screen.getByText(tab))
      for (const el of container.querySelectorAll<HTMLElement>(
        'input, select, textarea, [role="switch"], [role="radiogroup"]',
      )) {
        visited += 1
        expect(
          accessibleName(el),
          `${tab} 下存在无名控件：${el.outerHTML.slice(0, 120)}`,
        ).toBeTruthy()
      }
    }
    // 实测覆盖 26 个控件；下限只防门控空转（例如标签名写错导致一个控件都没遍历到）
    expect(visited).toBeGreaterThanOrEqual(20)
  })

  it('关闭按钮触发 onClose', () => {
    const onClose = vi.fn()
    renderSettings({ open: true, onClose })
    fireEvent.click(screen.getByTitle('关闭 (Esc)'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('未打开时不渲染', () => {
    const { container } = renderSettings({ open: false, onClose: vi.fn() })
    expect(container.firstChild).toBeNull()
  })

  it('按 Esc 键触发 onClose', () => {
    const onClose = vi.fn()
    renderSettings({ open: true, onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
import { useSettings } from '../../core/settings'

describe('useSettings', () => {
  it('updates settings within Provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SettingsProvider>{children}</SettingsProvider>
    )
    const { result } = renderHook(() => useSettings(), { wrapper })
    act(() => {
      result.current[1]({ fontSize: 20 })
    })
    expect(result.current[0].fontSize).toBe(20)
  })
})

describe('写作与习惯：全场只有一份每章目标（P3.9）', () => {
  it('移除无人读取的「分章提示」，每章目标只在编辑器页配置一次', () => {
    renderSettings({ open: true, onClose: vi.fn() })
    fireEvent.click(screen.getByText('写作与习惯'))

    expect(screen.queryByText('分章提示')).toBeNull()
    expect(screen.queryByLabelText('分章提示的每满字数')).toBeNull()

    // 唯一的一份在「编辑器」标签，且真的被状态栏读取（settings.wordTarget）
    fireEvent.click(screen.getByText('编辑器'))
    expect(screen.getAllByText(/每章字数目标/).length).toBeGreaterThan(0)
  })
})
