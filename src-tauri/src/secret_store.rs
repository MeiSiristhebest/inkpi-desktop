const SERVICE_NAME: &str = "com.inkpi.desktop";

#[tauri::command]
pub fn secret_store_set(key: String, value: String) -> Result<(), String> {
    validate_key(&key)?;
    if value.is_empty() {
        return secret_store_remove(key);
    }

    #[cfg(windows)]
    {
        let entry = keyring::Entry::new(SERVICE_NAME, &key)
            .map_err(|error| format!("failed to open OS credential entry: {error}"))?;
        entry
            .set_password(&value)
            .map_err(|error| format!("failed to write OS credential entry: {error}"))
    }
    #[cfg(not(windows))]
    {
        let _ = (key, value);
        Err("OS credential storage is only enabled for the Windows desktop build".to_string())
    }
}

pub(crate) fn secret_store_get(key: String) -> Result<Option<String>, String> {
    validate_key(&key)?;

    #[cfg(windows)]
    {
        let entry = keyring::Entry::new(SERVICE_NAME, &key)
            .map_err(|error| format!("failed to open OS credential entry: {error}"))?;
        match entry.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(format!("failed to read OS credential entry: {error}")),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = key;
        Err("OS credential storage is only enabled for the Windows desktop build".to_string())
    }
}

#[tauri::command]
pub fn secret_store_has(key: String) -> Result<bool, String> {
    Ok(secret_store_get(key)?.is_some())
}

#[tauri::command]
pub fn secret_store_remove(key: String) -> Result<(), String> {
    validate_key(&key)?;

    #[cfg(windows)]
    {
        let entry = keyring::Entry::new(SERVICE_NAME, &key)
            .map_err(|error| format!("failed to open OS credential entry: {error}"))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(format!("failed to delete OS credential entry: {error}")),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = key;
        Err("OS credential storage is only enabled for the Windows desktop build".to_string())
    }
}

fn validate_key(key: &str) -> Result<(), String> {
    if !key.starts_with("inkpi.model.") || key.len() <= "inkpi.model.".len() || key.len() > 256 {
        return Err("secret key must be a valid InkPi model credential reference".to_string());
    }
    if key.chars().any(char::is_control) {
        return Err("secret key must not contain control characters".to_string());
    }
    Ok(())
}
