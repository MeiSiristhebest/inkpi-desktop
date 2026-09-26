// InkPi 桌面外壳的原生菜单（§P4.7，当前只面向 Windows）。
//
// 两条边界都是刻意的：
//
// 1. 自定义命令一律 **不注册 accelerator**。快捷键的唯一主人是前端的
//    src/core/editorShortcuts.ts 注册表（§P4.6）；原生菜单再注册一份 Ctrl+S，
//    一次按键就可能被执行两遍——在写作工具里，「新建章节」被执行两遍是丢稿级别的事故。
//    菜单项的 id 会原样发回前端，由前端翻译回注册表里的那条 chord，所以鼠标路径和
//    键盘路径最终调用的是同一个 handler，不存在两份实现。
// 2. 标准 Edit / Window 项沿用 Tauri 的 PredefinedMenuItem，也就是 Tauri 默认菜单
//    本来就在发的那一批，因此这部分与改动前的运行时行为等价。
//
// 系统标题栏保留：本产品只发 Windows 包，不做仿 macOS 的自绘标题栏。

use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Wry};

/// 事件名：Rust → 前端，载荷就是下面这些 id 字符串。
pub const MENU_EVENT: &str = "desktop-menu";

/// 「文件」里的稿件命令。id 必须能在前端的 EDITOR_SHORTCUTS 里找到同名条目，
/// 这条跨语言契约由 src/core/desktopMenu.contract.test.ts 守住（它直接读本文件）。
const FILE_COMMANDS: &[(&str, &str)] = &[("newChapter", "新建章节"), ("saveChapter", "保存章节")];

/// 「视图」里的面板与导航命令。
const VIEW_COMMANDS: &[(&str, &str)] = &[
    ("commandPalette", "命令面板…"),
    ("toggleChapterTree", "切换章节树"),
    ("findReplace", "查找替换"),
    ("history", "打开历史记录"),
];

/// 菜单里全部自定义命令 id，供事件路由与测试使用。
pub fn command_ids() -> impl Iterator<Item = &'static str> {
    FILE_COMMANDS
        .iter()
        .chain(VIEW_COMMANDS.iter())
        .map(|(id, _)| *id)
}

pub fn is_command_id(id: &str) -> bool {
    command_ids().any(|known| known == id)
}

/// accelerator 传 None 的理由见文件头注释 1。
fn command(app: &AppHandle, id: &str, title: &str) -> tauri::Result<MenuItem<Wry>> {
    MenuItem::with_id(app, id, title, true, None::<&str>)
}

fn commands(app: &AppHandle, specs: &[(&str, &str)]) -> tauri::Result<Vec<MenuItem<Wry>>> {
    specs
        .iter()
        .map(|(id, title)| command(app, id, title))
        .collect()
}

/// 构建菜单栏；子菜单顺序即 Windows 标题栏下的显示顺序。
pub fn build(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let file_commands = commands(app, FILE_COMMANDS)?;
    let view_commands = commands(app, VIEW_COMMANDS)?;

    let separator = PredefinedMenuItem::separator(app)?;
    let close_window = PredefinedMenuItem::close_window(app, None)?;
    let quit = PredefinedMenuItem::quit(app, None)?;
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, None)?;
    let minimize = PredefinedMenuItem::minimize(app, None)?;
    let maximize = PredefinedMenuItem::maximize(app, None)?;

    let mut file_items: Vec<&dyn IsMenuItem<Wry>> = file_commands
        .iter()
        .map(|item| item as &dyn IsMenuItem<Wry>)
        .collect();
    file_items.push(&separator);
    file_items.push(&close_window);
    file_items.push(&quit);

    let mut view_items: Vec<&dyn IsMenuItem<Wry>> = view_commands
        .iter()
        .map(|item| item as &dyn IsMenuItem<Wry>)
        .collect();
    view_items.push(&separator);
    view_items.push(&fullscreen);

    let file = Submenu::with_items(app, "文件", true, &file_items)?;
    let edit = Submenu::with_items(
        app,
        "编辑",
        true,
        &[&undo, &redo, &separator, &cut, &copy, &paste, &select_all],
    )?;
    let view = Submenu::with_items(app, "视图", true, &view_items)?;
    let window = Submenu::with_items(app, "窗口", true, &[&minimize, &maximize])?;

    Menu::with_items(app, &[&file, &edit, &view, &window])
}

/// 挂到主窗口。在 `setup` 里调用。
pub fn install(app: &AppHandle) -> tauri::Result<()> {
    // set_menu 返回被替换掉的旧菜单（本产品此前没有显式菜单，所以是 None），
    // 这里只关心它有没有失败。
    app.set_menu(build(app)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_ids_are_unique() {
        let mut ids: Vec<&str> = command_ids().collect();
        let before = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(before, ids.len(), "菜单命令 id 出现重复");
        assert_eq!(before, 6);
    }

    #[test]
    fn titles_do_not_claim_a_chord_the_menu_never_registers() {
        // 菜单标题里写 Ctrl+…，而 accelerator 故意没注册（见文件头注释 1），
        // 就是在告诉用户一个不会兑现的按键。
        for (id, title) in FILE_COMMANDS.iter().chain(VIEW_COMMANDS.iter()) {
            assert!(
                !title.contains("Ctrl") && !title.contains('⌘'),
                "菜单项 {id} 的标题 {title} 自带快捷键文案"
            );
        }
    }
}
