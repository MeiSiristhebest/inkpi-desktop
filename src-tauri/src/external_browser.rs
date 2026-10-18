use std::ffi::c_void;
#[cfg(not(windows))]
use std::process::Command;

const CHATGPT_AUTHORIZATION_PREFIX: &str = "https://auth.openai.com/api/accounts/authorize?";
const CHATGPT_USAGE_SETTINGS_URL: &str = "https://chatgpt.com/settings/usage";

#[tauri::command]
pub fn open_chatgpt_plan_authorization_url(url: String) -> Result<(), String> {
    if !url.starts_with(CHATGPT_AUTHORIZATION_PREFIX)
        || url.chars().any(char::is_control)
        || url.contains('#')
        || url.chars().any(char::is_whitespace)
    {
        return Err("Only the OpenAI ChatGPT authorization URL can be opened".to_string());
    }

    open_external_url(&url)
}

#[tauri::command]
pub fn open_chatgpt_plan_usage_settings() -> Result<(), String> {
    open_external_url(CHATGPT_USAGE_SETTINGS_URL)
}

fn open_external_url(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "shell32")]
        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut c_void,
                operation: *const u16,
                file: *const u16,
                parameters: *const u16,
                directory: *const u16,
                show_command: i32,
            ) -> *mut c_void;
        }

        let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(Some(0)).collect();
        let target: Vec<u16> = OsStr::new(url).encode_wide().chain(Some(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                1,
            )
        } as isize;
        if result <= 32 {
            return Err("Windows could not open the ChatGPT sign-in URL".to_string());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        #[cfg(target_os = "macos")]
        let mut command = Command::new("open");
        #[cfg(target_os = "linux")]
        let mut command = Command::new("xdg-open");
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        return Err("ChatGPT sign-in browser launch is not supported on this platform".to_string());

        command
            .arg(url)
            .spawn()
            .map(|_| ())
            .map_err(|_| "Could not open the ChatGPT sign-in URL".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{CHATGPT_AUTHORIZATION_PREFIX, CHATGPT_USAGE_SETTINGS_URL};

    #[test]
    fn authorization_url_validation_is_scoped_to_the_openai_endpoint() {
        assert!(CHATGPT_AUTHORIZATION_PREFIX.starts_with("https://auth.openai.com/"));
        assert!(!"https://example.com/api/accounts/authorize?code=x"
            .starts_with(CHATGPT_AUTHORIZATION_PREFIX));
        assert!(!"javascript:alert(1)".starts_with(CHATGPT_AUTHORIZATION_PREFIX));
        assert!(CHATGPT_USAGE_SETTINGS_URL.starts_with("https://chatgpt.com/"));
    }
}
