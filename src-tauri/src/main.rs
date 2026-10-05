#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// InkPi 桌面工作台：Tauri 2 外壳
// 启动原生窗口加载 Vite SPA，并在运行时拉起 inkpi daemon (JSON-RPC, ws://127.0.0.1:8849)
// daemon 以 externalBin sidecar 形式随包分发（Bun 编译的单文件独立二进制，不再依赖 node 与 inkpi 源码目录）。

use std::process::{Child, Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::sync::{Mutex, OnceLock};
use tauri::Manager;

mod instance_config;
mod menu;
mod secret_store;

use instance_config::InstanceConfig;

// 后台管理的 inkpi daemon 子进程（应用退出时回收）
static DAEMON_CHILD: OnceLock<Mutex<Option<Child>>> = OnceLock::new();

/// 解析 inkpi daemon 可执行文件路径。
/// 优先级：
///   1. INKPI_DAEMON_SCRIPT 环境变量（本地开发指向 node 脚本 / 任意自定义二进制）
///   2. externalBin sidecar：Tauri 将其放在资源目录，文件名已去掉 target triple 后缀（inkpi.exe）
///   3. 与主程序同目录兜底
fn resolve_daemon_bin(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    // The script override is a development hook only. A packaged build must
    // never execute a path supplied by the process environment; it may only
    // launch the bundled sidecar.
    #[cfg(debug_assertions)]
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

    #[cfg(debug_assertions)]
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

/// Both child handles point at the same append-mode file, so the daemon's own
/// diagnostics survive a startup crash instead of vanishing into `Stdio::null()`.
fn daemon_log_stdio(path: &std::path::Path) -> Option<(Stdio, Stdio)> {
    let file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .ok()?;
    let stderr_file = file.try_clone().ok()?;
    Some((Stdio::from(file), Stdio::from(stderr_file)))
}

fn spawn_daemon(app: &tauri::AppHandle) -> Result<(), String> {
    let requested_config = InstanceConfig::from_process()?;
    let app_local_data_dir = if requested_config.profile.is_some() {
        Some(
            app.path()
                .app_local_data_dir()
                .map_err(|error| format!("failed to resolve app data directory: {error}"))?,
        )
    } else {
        None
    };
    let instance_config = requested_config.resolve(app_local_data_dir.as_deref())?;

    if let Some(profile_dir) = &instance_config.profile_dir {
        std::fs::create_dir_all(profile_dir).map_err(|error| {
            format!(
                "failed to create profile directory {}: {error}",
                profile_dir.display()
            )
        })?;
    }

    let bin = match resolve_daemon_bin(app) {
        Some(b) => b,
        None => {
            eprintln!(
                "[inkpi-desktop] 未找到 inkpi daemon 二进制（externalBin sidecar 缺失）。\
                 SPA 将无法连接 daemon。请确认 src-tauri/binaries/inkpi-<triple>.exe 已随包分发，\
                 或在 inkpi 仓库运行 pnpm build:binaries 后重新构建。"
            );
            return Ok(());
        }
    };

    let daemon_log_path = instance_config.daemon_log_path();
    let mut binding = Command::new(&bin);
    let cmd = binding.args(instance_config.daemon_args());
    match daemon_log_stdio(&daemon_log_path) {
        Some((stdout, stderr)) => {
            cmd.stdout(stdout).stderr(stderr);
        }
        None => {
            eprintln!(
                "[inkpi-desktop] 无法写入 daemon 日志 {}：daemon 输出将被丢弃，\
                 SPA 连不上时没有任何可查的原因。",
                daemon_log_path.display()
            );
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }

    for (key, value) in instance_config.environment_overrides() {
        cmd.env(key, value);
    }
    if let Some(profile_dir) = &instance_config.profile_dir {
        cmd.current_dir(profile_dir);
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let skills_dir = resource_dir.join("skills");
        if skills_dir.exists() {
            cmd.env("INKPI_SKILLS_DIR", skills_dir);
        }
    }

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    match cmd.spawn() {
        Ok(child) => {
            DAEMON_CHILD.get_or_init(|| Mutex::new(Some(child)));
            println!(
                "[inkpi-desktop] InkPi daemon spawned ({:?}) (profile={:?}, instance={:?}, http={}, ws={}, state_db={:?}, log={:?})",
                bin,
                instance_config.profile,
                instance_config.instance_id,
                instance_config.http_port,
                instance_config.ws_port,
                instance_config.state_db,
                daemon_log_path,
            );
        }
        Err(e) => {
            eprintln!(
                "[inkpi-desktop] 未能拉起 inkpi daemon ({}): {}",
                bin.display(),
                e
            );
        }
    }

    Ok(())
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn daemon_log_stdio_keeps_what_the_child_prints_before_it_dies() {
        let dir = std::env::temp_dir().join(format!("inkpi-daemon-log-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("scratch directory");
        let path = dir.join("daemon.log");
        let (stdout, stderr) = daemon_log_stdio(&path).expect("log handles");

        let status = Command::new("cmd")
            .args([
                "/C",
                "echo daemon-stdout & echo daemon-stderr 1>&2 & exit 1",
            ])
            .stdout(stdout)
            .stderr(stderr)
            .spawn()
            .expect("spawn a child that writes both streams")
            .wait()
            .expect("wait for the child");

        let captured = std::fs::read_to_string(&path).expect("read the daemon log");
        let _ = std::fs::remove_dir_all(&dir);

        assert!(status.code().is_some_and(|code| code != 0));
        assert!(
            captured.contains("daemon-stderr"),
            "stderr never reached {}: {captured:?}",
            path.display()
        );
        assert!(
            captured.contains("daemon-stdout"),
            "stdout never reached {}: {captured:?}",
            path.display()
        );
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            secret_store::secret_store_get,
            secret_store::secret_store_set,
            secret_store::secret_store_remove,
        ])
        // 菜单命令一律以 id 转发给前端，由前端翻译回 editorShortcuts 里的那条 chord，
        // 因此原生侧不复制第二份按键绑定（见 src/menu.rs 顶部注释）。
        .on_menu_event(|app, event| {
            use tauri::Emitter;
            let id = event.id().as_ref().to_string();
            if menu::is_command_id(&id) {
                if let Err(error) = app.emit(menu::MENU_EVENT, id) {
                    eprintln!("[inkpi-desktop] 菜单命令转发失败: {error}");
                }
            }
        })
        .setup(|app| {
            spawn_daemon(app.handle()).map_err(|message| {
                std::io::Error::new(std::io::ErrorKind::InvalidInput, message)
            })?;
            menu::install(app.handle())?;
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
