# Desktop Web 界面审查记录

2026-10-12。对象：本机 Vite `http://127.0.0.1:4175/`，Desktop 工作树 HEAD `719d34be49eb0261be2c5ac712be07472ce70aa6` 加既有未提交改动。浏览器为独立 Edge/Playwright 会话，作品为新建空白合成作品，没有读取或修改作者现有作品。

本次检查布局与控件，未调用模型。页面连接现有固定 sidecar，不能据此证明当前 Runtime 工作树已集成。以下结果不是完整可访问性或全部插件验收。

## 工具栏与目录

在同一合成作品、默认侧栏/目录状态下调整窗口宽度，测量常用按钮的 bounding box，并以中心点 `elementFromPoint` 检查鼠标可达性。

| 窗口宽度 | AI 按钮 x / width | 插件按钮 x / width | 正文列宽度 | 观察                                                   |
| -------: | ----------------- | ------------------ | ---------: | ------------------------------------------------------ |
|     1440 | 1414.45 / 26      | 1442.08 / 26       |        950 | AI 边缘超出窗口；插件中心点在窗口外                    |
|     1280 | 1321.89 / 26      | 1349.52 / 26       |        790 | AI、插件和聚焦按钮均超出窗口，中心点无法点击           |
|     1024 | 960.63 / 26       | 988.25 / 26        |        824 | 上述按钮在窗口内且中心点可点击                         |
|      900 | 836.63 / 26       | 864.25 / 26        |        900 | 目录成为浮层；返回按钮中心点被遮挡，正文左侧被目录覆盖 |
|      768 | 704.63 / 26       | 732.25 / 26        |        768 | 返回按钮中心点被目录遮挡                               |

截图：[1280 窗口](ui-plan-2026-10-12/ui-plan-editor-1280.png)、[900 窗口](ui-plan-2026-10-12/ui-plan-editor-900.png)。所有页面 `documentElement.scrollWidth` 与窗口宽度一致，不能用“页面没有水平滚动”证明这些按钮可见。

源码：[EditorToolbar](../../src/components/editor/organisms/EditorToolbar.tsx)（196、199、461）、[样式](../../src/index.css)（600–655、725–854）。现有 toolbar `overflow:hidden`，actions 隐藏水平滚动条，紧凑样式按 viewport 1100 断点触发；编辑区域还受侧栏/目录占宽影响。这里确认默认布局可见性问题，不声称完全无法从命令面板或键盘调用功能。

方案 U01/U02 要求按编辑区域可用宽度收纳次要项、固定常用入口，并明确窄窗口面板的互斥与关闭行为。

## 插件管理

实际设置页显示 44 个已安装插件、分类、详情和启停。初始“设定与世界书”分组的五个列表开关在语义快照中均为无名 button，没有 switch 状态；选择卡片是仅点击 generic，详情区“停用此插件”按钮有名称。

[插件设置截图](ui-plan-2026-10-12/ui-plan-plugins.png)。源码：[PluginSettingsView](../../src/components/plugins/PluginSettingsView.tsx)（134–207）。需要补稳定名称、状态、可见焦点及键盘选择，不能把详情按钮有名称当成列表开关已验收。

## 新建作品

只填写书名可以创建并进入空白作品。新建界面是展开式内联 panel，无须添加 modal dialog 角色。关闭图标缺名称，封面上传为点击 div、移除为点击 span；这些应使用键盘可达控件。源码：[CreateProjectPanel](../../src/components/bookshelf/organisms/CreateProjectPanel.tsx)（80–120）。

## 独立复现与未运行范围

现有插件 registry 和 overlay hook 的故障注入/隔离执行见 [复现 JSON](plugin-component-reproductions-2026-10-12.json)。它们复现保存失败被吞、初始化覆盖选择、嵌套 Escape 同时关闭、输入法 Escape 关闭、链接焦点遗漏、零控件 Tab；不等同于实际中文输入法、Select portal 或屏幕阅读器验收。

本轮未验证真实 IME、Windows DPI、主题全组合、屏幕阅读器、44 个插件全部功能、真实 Provider、Tauri 壳和安装器。后续场景见 [优化方案](../plans/writing-product-optimization-2026-10-12.md)。隔离浏览器检查结束后关闭；保留用户已要求运行的本机 Web/Runtime 服务。
