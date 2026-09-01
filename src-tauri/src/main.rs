#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// InkPi 桌面工作台：Tauri 2 外壳
// 启动原生窗口加载 Vite SPA，并在运行时拉起 inkpi daemon (JSON-RPC, ws://127.0.0.1:8849)
// daemon 以 externalBin sidecar 形式随包分发（Bun 编译的单文件独立二进制，不再依赖 node 与 inkpi 源码目录）。

use std::process::{Child, Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

// 后台管理的 inkpi daemon 子进程（应用退出时回收）
static DAEMON_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

/// 解析 inkpi daemon 可执行文件路径。
/// 优先级：
///   1. INKPI_DAEMON_SCRIPT 环境变量（本地开发指向 node 脚本 / 任意自定义二进制）
///   2. externalBin sidecar：Tauri 将其放在资源目录，文件名已去掉 target triple 后缀（inkpi.exe）
///   3. 与主程序同目录兜底
fn resolve_daemon_bin(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    if let Ok(p) = std::env::var("INKPI_DAEMON_SCRIPT") {
        let path = std::path::PathBuf::from(p);
        if path.exists() {
            return Some(path);
        }
        eprintln!(
            "[inkpi-desktop] INKPI_DAEMON_SCRIPT 指向的路径不存在，回退到 externalBin sidecar: {}",
            path.display()
        );
    }

    if let Ok(res_dir) = app.path().resource_dir() {
        let sidecar = res_dir.join("inkpi.exe");
        if sidecar.exists() {
            return Some(sidecar);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let sidecar = dir.join("inkpi.exe");
            if sidecar.exists() {
                return Some(sidecar);
            }
        }
    }

    None
}

fn spawn_daemon(app: &tauri::AppHandle) {
    let bin = match resolve_daemon_bin(app) {
        Some(b) => b,
        None => {
            eprintln!(
                "[inkpi-desktop] 未找到 inkpi daemon 二进制（externalBin sidecar 缺失）。\
                 SPA 将无法连接 daemon。请确认 src-tauri/binaries/inkpi-<triple>.exe 已随包分发，\
                 或在 inkpi 仓库运行 pnpm build:binaries 后重新构建。"
            );
            return;
        }
    };

    let mut binding = Command::new(&bin);
    let cmd = binding
        .args(["daemon", "--port", "8848"])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn()
    {
        Ok(child) => {
            DAEMON_CHILD.get_or_init(|| Mutex::new(Some(child)));
            println!("[inkpi-desktop] InkPi daemon spawned ({:?}) (tcp 8848 / ws 8849)", bin);
        }
        Err(e) => {
            eprintln!(
                "[inkpi-desktop] 未能拉起 inkpi daemon ({}): {}",
                bin.display(),
                e
            );
        }
    }
}

fn kill_daemon() {
    if let Some(lock) = DAEMON_CHILD.get() {
        if let Ok(mut guard) = lock.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                println!("[inkpi-desktop] InkPi daemon stopped");
            }
        }
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            spawn_daemon(app.handle());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                kill_daemon();
            }
        });
}
