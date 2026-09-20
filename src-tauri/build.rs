#[cfg(windows)]
fn prepare_ascii_icon() -> Option<std::path::PathBuf> {
    let source = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("icons")
        .join("icon.ico");
    let temp_dirs = [
        std::env::var_os("TEMP").map(std::path::PathBuf::from),
        Some(std::path::PathBuf::from(r"C:\\Windows\\Temp")),
        Some(std::path::PathBuf::from(r"C:\\Temp")),
    ];

    for temp_dir in temp_dirs.into_iter().flatten() {
        if !temp_dir.to_string_lossy().is_ascii() {
            continue;
        }
        if std::fs::create_dir_all(&temp_dir).is_err() {
            continue;
        }
        let target = temp_dir.join(format!("inkpi-tauri-icon-{}.ico", std::process::id()));
        if std::fs::copy(&source, &target).is_ok() {
            return Some(target);
        }
    }

    None
}

#[cfg(windows)]
fn main() {
    let icon = prepare_ascii_icon();
    let attributes = match icon.as_ref() {
        Some(path) => tauri_build::Attributes::new()
            .windows_attributes(tauri_build::WindowsAttributes::new().window_icon_path(path)),
        None => tauri_build::Attributes::new(),
    };

    tauri_build::try_build(attributes).expect("failed to run Tauri build script");

    if let Some(path) = icon {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(not(windows))]
fn main() {
    tauri_build::build();
}
