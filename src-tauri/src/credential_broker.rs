use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{IpAddr, SocketAddr, TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use uuid::Uuid;

const MAX_REQUEST_BYTES: usize = 4096;

#[derive(Deserialize)]
struct CredentialRequest {
    token: String,
    credential_ref: String,
}

#[derive(Serialize)]
struct CredentialResponse {
    credential: Option<String>,
    error: Option<&'static str>,
}

pub struct CredentialBroker {
    address: SocketAddr,
    token: String,
    stop: Arc<AtomicBool>,
    listener_thread: Option<JoinHandle<()>>,
}

impl CredentialBroker {
    pub fn start() -> Result<Self, String> {
        let listener = TcpListener::bind((IpAddr::V4(std::net::Ipv4Addr::LOCALHOST), 0))
            .map_err(|error| format!("failed to bind credential broker: {error}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|error| format!("failed to configure credential broker: {error}"))?;
        let address = listener
            .local_addr()
            .map_err(|error| format!("failed to read credential broker address: {error}"))?;
        let token = Uuid::new_v4().simple().to_string();
        let stop = Arc::new(AtomicBool::new(false));
        let listener_stop = Arc::clone(&stop);
        let listener_token = token.clone();
        let listener_thread = thread::Builder::new()
            .name("inkpi-credential-broker".to_string())
            .spawn(move || {
                while !listener_stop.load(Ordering::Acquire) {
                    match listener.accept() {
                        Ok((stream, peer)) if peer.ip().is_loopback() => {
                            let token = listener_token.clone();
                            let _ = thread::Builder::new()
                                .name("inkpi-credential-request".to_string())
                                .spawn(move || handle_request(stream, &token));
                        }
                        Ok((_stream, _peer)) => {}
                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(20));
                        }
                        Err(_) => break,
                    }
                }
            })
            .map_err(|error| format!("failed to start credential broker: {error}"))?;

        Ok(Self {
            address,
            token,
            stop,
            listener_thread: Some(listener_thread),
        })
    }

    pub fn address(&self) -> SocketAddr {
        self.address
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    fn shutdown(&mut self) {
        self.stop.store(true, Ordering::Release);
        if let Some(thread) = self.listener_thread.take() {
            let _ = thread.join();
        }
    }
}

impl Drop for CredentialBroker {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn handle_request(mut stream: TcpStream, expected_token: &str) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));
    let Ok(reader_stream) = stream.try_clone() else {
        return;
    };
    let mut reader = BufReader::new(reader_stream).take((MAX_REQUEST_BYTES + 1) as u64);
    let mut line = String::new();
    let response = match reader.read_line(&mut line) {
        Ok(length) if length <= MAX_REQUEST_BYTES => resolve_request(&line, expected_token),
        _ => CredentialResponse {
            credential: None,
            error: Some("invalid request"),
        },
    };
    if let Ok(mut encoded) = serde_json::to_vec(&response) {
        encoded.push(b'\n');
        let _ = stream.write_all(&encoded);
    }
}

fn resolve_request(line: &str, expected_token: &str) -> CredentialResponse {
    let request: CredentialRequest = match serde_json::from_str(line) {
        Ok(request) => request,
        Err(_) => {
            return CredentialResponse {
                credential: None,
                error: Some("invalid request"),
            }
        }
    };
    if !constant_time_eq(&request.token, expected_token) {
        return CredentialResponse {
            credential: None,
            error: Some("unauthorized"),
        };
    }
    if !is_model_credential_ref(&request.credential_ref) {
        return CredentialResponse {
            credential: None,
            error: Some("invalid credential reference"),
        };
    }
    match crate::secret_store::secret_store_get(request.credential_ref) {
        Ok(credential) => CredentialResponse {
            credential,
            error: None,
        },
        Err(_) => CredentialResponse {
            credential: None,
            error: Some("credential store unavailable"),
        },
    }
}

fn is_model_credential_ref(credential_ref: &str) -> bool {
    credential_ref.starts_with("inkpi.model.")
        && credential_ref.len() <= 256
        && !credential_ref.chars().any(char::is_control)
}

fn constant_time_eq(left: &str, right: &str) -> bool {
    let left = left.as_bytes();
    let right = right.as_bytes();
    let mut difference = left.len() ^ right.len();
    for index in 0..left.len().max(right.len()) {
        difference |= usize::from(
            left.get(index).copied().unwrap_or(0) ^ right.get(index).copied().unwrap_or(0),
        );
    }
    difference == 0
}

#[cfg(test)]
mod tests {
    use super::{constant_time_eq, is_model_credential_ref, resolve_request};

    #[test]
    fn only_accepts_model_secret_references() {
        assert!(is_model_credential_ref("inkpi.model.openai.gpt-4o"));
        assert!(!is_model_credential_ref("inkpi.other.token"));
        assert!(!is_model_credential_ref("inkpi.model.\nopenai"));
        assert!(!is_model_credential_ref(&format!(
            "inkpi.model.{}",
            "x".repeat(256)
        )));
    }

    #[test]
    fn compares_tokens_without_short_circuiting_on_the_first_difference() {
        assert!(constant_time_eq("same-token", "same-token"));
        assert!(!constant_time_eq("same-token", "same-tokeN"));
        assert!(!constant_time_eq("short", "longer"));
    }

    #[test]
    fn rejects_an_invalid_token_before_accessing_the_credential_store() {
        let response = resolve_request(
            r#"{"token":"wrong","credential_ref":"inkpi.model.openai.gpt-4o"}"#,
            "expected-token",
        );
        assert_eq!(response.credential, None);
        assert_eq!(response.error, Some("unauthorized"));
    }

    #[test]
    fn rejects_references_outside_the_model_namespace() {
        let response = resolve_request(
            r#"{"token":"expected-token","credential_ref":"inkpi.other.secret"}"#,
            "expected-token",
        );
        assert_eq!(response.credential, None);
        assert_eq!(response.error, Some("invalid credential reference"));
    }
}
