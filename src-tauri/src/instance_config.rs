use std::path::{Path, PathBuf};

pub(crate) const DEFAULT_HTTP_PORT: u16 = 8848;
pub(crate) const DEFAULT_WS_PORT: u16 = 8849;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct InstanceConfig {
    pub(crate) profile: Option<String>,
    pub(crate) state_db: Option<PathBuf>,
    pub(crate) http_port: u16,
    pub(crate) ws_port: u16,
    pub(crate) instance_id: Option<String>,
    http_port_explicit: bool,
    ws_port_explicit: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedInstanceConfig {
    pub(crate) profile: Option<String>,
    pub(crate) profile_dir: Option<PathBuf>,
    pub(crate) state_db: Option<PathBuf>,
    pub(crate) http_port: u16,
    pub(crate) ws_port: u16,
    pub(crate) instance_id: Option<String>,
    isolated: bool,
}

impl InstanceConfig {
    pub(crate) fn from_process() -> Result<Self, String> {
        let args: Vec<String> = std::env::args().skip(1).collect();
        Self::from_args_and_env(&args, |key| std::env::var(key).ok())
    }

    pub(crate) fn from_args_and_env<F>(args: &[String], env: F) -> Result<Self, String>
    where
        F: Fn(&str) -> Option<String>,
    {
        let (profile_raw, _) = configured_value(
            args,
            &env,
            &["--profile"],
            &["INKPI_DESKTOP_PROFILE", "INKPI_PROFILE"],
        )?;
        let profile = profile_raw
            .map(|value| normalize_component("profile", &value))
            .transpose()?;

        let (state_db_raw, _) = configured_value(
            args,
            &env,
            &["--state-db", "--db-path"],
            &["INKPI_DESKTOP_STATE_DB", "INKPI_STATE_DB"],
        )?;
        let state_db = state_db_raw
            .map(|value| {
                let normalized = value.trim();
                if normalized.is_empty() {
                    Err("state DB path must not be empty".to_string())
                } else {
                    Ok(PathBuf::from(normalized))
                }
            })
            .transpose()?;

        let (http_port_raw, http_port_explicit) = configured_value(
            args,
            &env,
            &["--http-port", "--port"],
            &["INKPI_DESKTOP_HTTP_PORT", "INKPI_HTTP_PORT", "INKPI_PORT"],
        )?;
        let http_port = http_port_raw
            .as_deref()
            .map(|value| parse_port("HTTP", value))
            .transpose()?
            .unwrap_or(DEFAULT_HTTP_PORT);

        let (ws_port_raw, ws_port_explicit) = configured_value(
            args,
            &env,
            &["--ws-port"],
            &["INKPI_DESKTOP_WS_PORT", "INKPI_WS_PORT"],
        )?;
        let ws_port = match ws_port_raw.as_deref() {
            Some(value) => parse_port("WebSocket", value)?,
            None => http_port.checked_add(1).ok_or_else(|| {
                "WebSocket port cannot be derived from HTTP port 65535".to_string()
            })?,
        };

        if http_port != 0 && ws_port != 0 && http_port == ws_port {
            return Err(format!(
                "HTTP and WebSocket ports must differ (both were {http_port})"
            ));
        }

        let (instance_id_raw, _) = configured_value(
            args,
            &env,
            &["--instance-id"],
            &["INKPI_DESKTOP_INSTANCE_ID", "INKPI_INSTANCE_ID"],
        )?;
        let instance_id = instance_id_raw
            .map(|value| normalize_component("instance id", &value))
            .transpose()?
            .or_else(|| profile.clone());

        Ok(Self {
            profile,
            state_db,
            http_port,
            ws_port,
            instance_id,
            http_port_explicit,
            ws_port_explicit,
        })
    }

    pub(crate) fn resolve(
        &self,
        app_local_data_dir: Option<&Path>,
    ) -> Result<ResolvedInstanceConfig, String> {
        let profile_dir = match (&self.profile, app_local_data_dir) {
            (Some(profile), Some(root)) => Some(root.join("profiles").join(profile)),
            (Some(_), None) => {
                return Err("an app data directory is required when --profile is set".to_string())
            }
            (None, _) => None,
        };
        let state_db = self
            .state_db
            .clone()
            .or_else(|| profile_dir.as_ref().map(|dir| dir.join("state.sqlite")));

        Ok(ResolvedInstanceConfig {
            profile: self.profile.clone(),
            profile_dir,
            state_db,
            http_port: self.http_port,
            ws_port: self.ws_port,
            instance_id: self.instance_id.clone(),
            isolated: self.has_overrides(),
        })
    }

    fn has_overrides(&self) -> bool {
        self.profile.is_some()
            || self.state_db.is_some()
            || self.instance_id.is_some()
            || self.http_port_explicit
            || self.ws_port_explicit
    }
}

impl ResolvedInstanceConfig {
    pub(crate) fn daemon_args(&self) -> Vec<String> {
        let mut args = vec![
            "daemon".to_string(),
            "--port".to_string(),
            self.http_port.to_string(),
        ];

        // The current Runtime CLI accepts --port, --ws-port and --state-db.
        // Profile and instance id are passed through environment variables below
        // so older sidecars remain compatible with this launcher.
        if self.isolated {
            args.extend(["--ws-port".to_string(), self.ws_port.to_string()]);
        }
        if let Some(state_db) = &self.state_db {
            args.extend([
                "--state-db".to_string(),
                state_db.to_string_lossy().into_owned(),
            ]);
        }
        args
    }

    pub(crate) fn environment_overrides(&self) -> Vec<(&'static str, String)> {
        let mut variables = Vec::new();
        if let Some(profile) = &self.profile {
            variables.push(("INKPI_PROFILE", profile.clone()));
        }
        if let Some(profile_dir) = &self.profile_dir {
            variables.push((
                "INKPI_PROFILE_DIR",
                profile_dir.to_string_lossy().into_owned(),
            ));
        }
        if let Some(instance_id) = &self.instance_id {
            variables.push(("INKPI_INSTANCE_ID", instance_id.clone()));
        }
        if let Some(state_db) = &self.state_db {
            variables.push(("INKPI_STATE_DB", state_db.to_string_lossy().into_owned()));
        }
        if self.isolated {
            variables.push(("INKPI_HTTP_PORT", self.http_port.to_string()));
            variables.push(("INKPI_WS_PORT", self.ws_port.to_string()));
        }
        variables
    }
}

fn configured_value<F>(
    args: &[String],
    env: &F,
    flags: &[&str],
    env_keys: &[&str],
) -> Result<(Option<String>, bool), String>
where
    F: Fn(&str) -> Option<String>,
{
    if let Some(value) = option_value(args, flags)? {
        return Ok((Some(value), true));
    }

    for key in env_keys {
        if let Some(value) = env(key) {
            if !value.trim().is_empty() {
                return Ok((Some(value), true));
            }
        }
    }
    Ok((None, false))
}

fn option_value(args: &[String], flags: &[&str]) -> Result<Option<String>, String> {
    let mut result = None;
    let mut index = 0;
    while index < args.len() {
        let argument = &args[index];
        if argument == "--" {
            break;
        }

        if let Some((flag, value)) = argument.split_once('=') {
            if flags.iter().any(|candidate| *candidate == flag) {
                result = Some(value.to_string());
            }
            index += 1;
            continue;
        }

        if flags.iter().any(|candidate| *candidate == argument) {
            let value = args
                .get(index + 1)
                .ok_or_else(|| format!("{argument} requires a value"))?;
            if value.starts_with('-') {
                return Err(format!("{argument} requires a value"));
            }
            result = Some(value.clone());
            index += 2;
            continue;
        }
        index += 1;
    }
    Ok(result)
}

fn parse_port(kind: &str, value: &str) -> Result<u16, String> {
    value
        .trim()
        .parse::<u16>()
        .map_err(|_| format!("{kind} port must be an integer between 0 and 65535: {value}"))
}

fn normalize_component(kind: &str, value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{kind} must not be empty"));
    }
    if normalized == "." || normalized == ".." || normalized.len() > 128 {
        return Err(format!("{kind} is not a valid profile component: {value}"));
    }
    if normalized.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '/' | '\\' | '<' | '>' | ':' | '"' | '|' | '?' | '*'
            )
    }) || normalized.ends_with('.')
        || normalized.ends_with(' ')
    {
        return Err(format!("{kind} is not a valid profile component: {value}"));
    }
    Ok(normalized.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn as_env(config: &ResolvedInstanceConfig) -> HashMap<String, String> {
        config
            .environment_overrides()
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect()
    }

    #[test]
    fn no_options_keep_the_existing_single_instance_command() {
        let config = InstanceConfig::from_args_and_env(&[], |_| None).expect("default config");
        let resolved = config.resolve(None).expect("default resolution");

        assert_eq!(resolved.http_port, DEFAULT_HTTP_PORT);
        assert_eq!(resolved.ws_port, DEFAULT_WS_PORT);
        assert_eq!(resolved.profile, None);
        assert_eq!(resolved.state_db, None);
        assert_eq!(resolved.instance_id, None);
        assert_eq!(resolved.daemon_args(), ["daemon", "--port", "8848"]);
        assert!(resolved.environment_overrides().is_empty());
    }

    #[test]
    fn explicit_values_are_forwarded_without_unsupported_runtime_flags() {
        let args = [
            "--profile",
            "writer-a",
            "--state-db",
            r"C:\InkPi\writer-a\state.sqlite",
            "--http-port",
            "18848",
            "--ws-port",
            "18849",
            "--instance-id",
            "desktop-a",
        ]
        .into_iter()
        .map(str::to_string)
        .collect::<Vec<_>>();
        let config = InstanceConfig::from_args_and_env(&args, |_| None).expect("explicit config");
        let resolved = config
            .resolve(Some(Path::new(r"C:\InkPi\app-data")))
            .expect("explicit resolution");

        assert_eq!(
            resolved.daemon_args(),
            [
                "daemon",
                "--port",
                "18848",
                "--ws-port",
                "18849",
                "--state-db",
                r"C:\InkPi\writer-a\state.sqlite",
            ]
        );
        let environment = as_env(&resolved);
        assert_eq!(
            environment.get("INKPI_PROFILE"),
            Some(&"writer-a".to_string())
        );
        assert_eq!(
            environment.get("INKPI_INSTANCE_ID"),
            Some(&"desktop-a".to_string())
        );
        assert_eq!(
            environment.get("INKPI_STATE_DB"),
            Some(&r"C:\InkPi\writer-a\state.sqlite".to_string())
        );
        assert_eq!(
            environment.get("INKPI_HTTP_PORT"),
            Some(&"18848".to_string())
        );
        assert_eq!(environment.get("INKPI_WS_PORT"), Some(&"18849".to_string()));
    }

    #[test]
    fn profile_gets_a_separate_state_db_and_default_instance_id() {
        let args = ["--profile=writer-b".to_string()];
        let config = InstanceConfig::from_args_and_env(&args, |_| None).expect("profile config");
        let resolved = config
            .resolve(Some(Path::new(r"C:\InkPi\app-data")))
            .expect("profile resolution");

        assert_eq!(
            resolved.profile_dir,
            Some(PathBuf::from(r"C:\InkPi\app-data\profiles\writer-b"))
        );
        assert_eq!(
            resolved.state_db,
            Some(PathBuf::from(
                r"C:\InkPi\app-data\profiles\writer-b\state.sqlite"
            ))
        );
        assert_eq!(resolved.instance_id, Some("writer-b".to_string()));
        assert!(resolved.daemon_args().contains(&"--state-db".to_string()));
        assert_eq!(
            as_env(&resolved).get("INKPI_PROFILE_DIR"),
            Some(&r"C:\InkPi\app-data\profiles\writer-b".to_string())
        );
    }

    #[test]
    fn command_line_values_take_precedence_over_environment_values() {
        let args = ["--profile", "cli-profile", "--http-port", "19000"]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        let environment = HashMap::from([
            ("INKPI_PROFILE", "env-profile"),
            ("INKPI_STATE_DB", r"C:\InkPi\env\state.sqlite"),
            ("INKPI_HTTP_PORT", "19001"),
            ("INKPI_WS_PORT", "19002"),
            ("INKPI_INSTANCE_ID", "env-instance"),
        ]);
        let config = InstanceConfig::from_args_and_env(&args, |key| {
            environment.get(key).map(|value| (*value).to_string())
        })
        .expect("precedence config");

        assert_eq!(config.profile, Some("cli-profile".to_string()));
        assert_eq!(config.http_port, 19000);
        assert_eq!(config.ws_port, 19002);
        assert_eq!(config.instance_id, Some("env-instance".to_string()));
        assert_eq!(
            config.state_db,
            Some(PathBuf::from(r"C:\InkPi\env\state.sqlite"))
        );
    }

    #[test]
    fn invalid_values_fail_before_a_sidecar_can_use_default_ports() {
        let invalid_port = ["--http-port", "65536"]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        assert!(InstanceConfig::from_args_and_env(&invalid_port, |_| None).is_err());

        let invalid_profile = ["--profile", "writer/../other"]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        assert!(InstanceConfig::from_args_and_env(&invalid_profile, |_| None).is_err());

        let same_port = ["--port", "19000", "--ws-port", "19000"]
            .into_iter()
            .map(str::to_string)
            .collect::<Vec<_>>();
        assert!(InstanceConfig::from_args_and_env(&same_port, |_| None).is_err());

        let empty_state_db = ["--state-db=".to_string()];
        assert!(InstanceConfig::from_args_and_env(&empty_state_db, |_| None).is_err());
    }

    #[test]
    fn two_explicit_profiles_have_distinct_runtime_resources() {
        let first_args = [
            "--profile",
            "writer-a",
            "--http-port",
            "18848",
            "--ws-port",
            "18849",
            "--instance-id",
            "desktop-a",
        ]
        .into_iter()
        .map(str::to_string)
        .collect::<Vec<_>>();
        let second_args = [
            "--profile",
            "writer-b",
            "--http-port",
            "18858",
            "--ws-port",
            "18859",
            "--instance-id",
            "desktop-b",
        ]
        .into_iter()
        .map(str::to_string)
        .collect::<Vec<_>>();
        let first = InstanceConfig::from_args_and_env(&first_args, |_| None)
            .expect("first instance config")
            .resolve(Some(Path::new(r"C:\InkPi\app-data")))
            .expect("first instance resolution");
        let second = InstanceConfig::from_args_and_env(&second_args, |_| None)
            .expect("second instance config")
            .resolve(Some(Path::new(r"C:\InkPi\app-data")))
            .expect("second instance resolution");

        assert_ne!(first.profile_dir, second.profile_dir);
        assert_ne!(first.state_db, second.state_db);
        assert_ne!(first.http_port, second.http_port);
        assert_ne!(first.ws_port, second.ws_port);
        assert_ne!(first.instance_id, second.instance_id);
    }
}
