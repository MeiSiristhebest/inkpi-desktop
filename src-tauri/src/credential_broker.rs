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

const MAX_CREDENTIAL_BYTES: usize = 32 * 1024;
const MAX_CREDENTIAL_CHUNK_BYTES: usize = 2048;
const MAX_CREDENTIAL_CHUNKS: usize = MAX_CREDENTIAL_BYTES / MAX_CREDENTIAL_CHUNK_BYTES;
const MAX_REQUEST_BYTES: usize = 33_792;
const MAX_RESPONSE_BYTES: usize = 33_792;
const CHUNK_MANIFEST_PREFIX: &str = "inkpi-chunks-v1";

#[derive(Deserialize)]
struct CredentialRequest {
    token: String,
    #[serde(default)]
    operation: String,
    credential_ref: String,
    value: Option<String>,
}

#[derive(Serialize)]
struct CredentialResponse {
    credential: Option<String>,
    success: bool,
    error: Option<&'static str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ChunkManifest {
    generation: String,
    count: usize,
    byte_length: usize,
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
    let _ = stream.set_read_timeout(Some(Duration::from_secs(10)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
    let Ok(reader_stream) = stream.try_clone() else {
        return;
    };
    let mut reader = BufReader::new(reader_stream).take((MAX_REQUEST_BYTES + 1) as u64);
    let mut line = String::new();
    let response = match reader.read_line(&mut line) {
        Ok(length) if length <= MAX_REQUEST_BYTES => resolve_request(&line, expected_token),
        _ => error_response("invalid request"),
    };
    if let Ok(mut encoded) = serde_json::to_vec(&response) {
        if encoded.len() <= MAX_RESPONSE_BYTES {
            encoded.push(b'\n');
            let _ = stream.write_all(&encoded);
        }
    }
}

fn resolve_request(line: &str, expected_token: &str) -> CredentialResponse {
    let request: CredentialRequest = match serde_json::from_str(line) {
        Ok(request) => request,
        Err(_) => return error_response("invalid request"),
    };
    if !constant_time_eq(&request.token, expected_token) {
        return error_response("unauthorized");
    }
    if !is_model_credential_ref(&request.credential_ref) {
        return error_response("invalid credential reference");
    }

    match request.operation.as_str() {
        "" | "get" => match read_credential(&request.credential_ref) {
            Ok(credential) => CredentialResponse {
                credential,
                success: true,
                error: None,
            },
            Err(_) => error_response("credential store unavailable"),
        },
        "set" => {
            if !is_chatgpt_plan_credential_ref(&request.credential_ref) {
                return error_response("credential writes are limited to ChatGPT plan references");
            }
            let Some(value) = request.value else {
                return error_response("invalid request");
            };
            if value.is_empty() {
                return match remove_credential(&request.credential_ref) {
                    Ok(()) => success_response(),
                    Err(_) => error_response("credential store unavailable"),
                };
            }
            match write_credential(&request.credential_ref, &value) {
                Ok(()) => success_response(),
                Err(_) => error_response("credential store unavailable"),
            }
        }
        "remove" => {
            if !is_chatgpt_plan_credential_ref(&request.credential_ref) {
                return error_response("credential writes are limited to ChatGPT plan references");
            }
            match remove_credential(&request.credential_ref) {
                Ok(()) => success_response(),
                Err(_) => error_response("credential store unavailable"),
            }
        }
        _ => error_response("invalid operation"),
    }
}

fn read_credential(credential_ref: &str) -> Result<Option<String>, String> {
    let Some(value) = crate::secret_store::secret_store_get(credential_ref.to_string())? else {
        return Ok(None);
    };
    let Some(manifest) = parse_chunk_manifest(&value) else {
        return Ok(Some(value));
    };

    let mut result = String::with_capacity(manifest.byte_length);
    for index in 0..manifest.count {
        let key = chunk_key(&manifest.generation, index);
        let part = crate::secret_store::secret_store_get(key)?
            .ok_or_else(|| "credential chunk is missing".to_string())?;
        result.push_str(&part);
        if result.len() > MAX_CREDENTIAL_BYTES {
            return Err("credential chunks exceed the size limit".to_string());
        }
    }
    if result.len() != manifest.byte_length {
        return Err("credential chunk length does not match the manifest".to_string());
    }
    Ok(Some(result))
}

fn write_credential(credential_ref: &str, value: &str) -> Result<(), String> {
    if value.len() > MAX_CREDENTIAL_BYTES {
        return Err("credential value exceeds the size limit".to_string());
    }
    let old_manifest = crate::secret_store::secret_store_get(credential_ref.to_string())?
        .and_then(|value| parse_chunk_manifest(&value));
    if value.len() <= MAX_CREDENTIAL_CHUNK_BYTES {
        crate::secret_store::secret_store_set(credential_ref.to_string(), value.to_string())?;
        if let Some(old) = old_manifest {
            remove_chunk_generation(&old)?;
        }
        return Ok(());
    }

    let generation = Uuid::new_v4().simple().to_string();
    let chunks = split_utf8(value);
    let mut written = Vec::with_capacity(chunks.len());
    for (index, chunk) in chunks.iter().enumerate() {
        let key = chunk_key(&generation, index);
        if let Err(error) = crate::secret_store::secret_store_set(key.clone(), (*chunk).to_string())
        {
            for written_key in written {
                let _ = crate::secret_store::secret_store_remove(written_key);
            }
            return Err(error);
        }
        written.push(key);
    }
    let manifest = ChunkManifest {
        generation,
        count: chunks.len(),
        byte_length: value.len(),
    };
    if let Err(error) = crate::secret_store::secret_store_set(
        credential_ref.to_string(),
        format_chunk_manifest(&manifest),
    ) {
        for written_key in written {
            let _ = crate::secret_store::secret_store_remove(written_key);
        }
        return Err(error);
    }
    if let Some(old) = old_manifest {
        remove_chunk_generation(&old)?;
    }
    Ok(())
}

fn remove_credential(credential_ref: &str) -> Result<(), String> {
    let old_manifest = crate::secret_store::secret_store_get(credential_ref.to_string())?
        .and_then(|value| parse_chunk_manifest(&value));
    crate::secret_store::secret_store_remove(credential_ref.to_string())?;
    if let Some(old) = old_manifest {
        remove_chunk_generation(&old)?;
    }
    Ok(())
}

fn remove_chunk_generation(manifest: &ChunkManifest) -> Result<(), String> {
    for index in 0..manifest.count {
        crate::secret_store::secret_store_remove(chunk_key(&manifest.generation, index))?;
    }
    Ok(())
}

fn split_utf8(value: &str) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut start = 0;
    for (index, character) in value.char_indices() {
        let end = index + character.len_utf8();
        if end - start > MAX_CREDENTIAL_CHUNK_BYTES {
            chunks.push(&value[start..index]);
            start = index;
        }
    }
    if start < value.len() {
        chunks.push(&value[start..]);
    }
    chunks
}

fn chunk_key(generation: &str, index: usize) -> String {
    format!("inkpi.model.__chunk.{generation}.{index}")
}

fn format_chunk_manifest(manifest: &ChunkManifest) -> String {
    format!(
        "{CHUNK_MANIFEST_PREFIX}:{}:{}:{}",
        manifest.generation, manifest.count, manifest.byte_length
    )
}

fn parse_chunk_manifest(value: &str) -> Option<ChunkManifest> {
    let mut parts = value.split(':');
    if parts.next()? != CHUNK_MANIFEST_PREFIX {
        return None;
    }
    let generation = parts.next()?;
    let count = parts.next()?.parse::<usize>().ok()?;
    let byte_length = parts.next()?.parse::<usize>().ok()?;
    if parts.next().is_some()
        || generation.len() != 32
        || !generation.bytes().all(|byte| byte.is_ascii_hexdigit())
        || count == 0
        || count > MAX_CREDENTIAL_CHUNKS
        || byte_length <= MAX_CREDENTIAL_CHUNK_BYTES
        || byte_length > MAX_CREDENTIAL_BYTES
    {
        return None;
    }
    Some(ChunkManifest {
        generation: generation.to_ascii_lowercase(),
        count,
        byte_length,
    })
}

fn is_model_credential_ref(credential_ref: &str) -> bool {
    credential_ref.starts_with("inkpi.model.")
        && credential_ref.len() <= 256
        && !credential_ref.chars().any(char::is_control)
}

fn is_chatgpt_plan_credential_ref(credential_ref: &str) -> bool {
    matches!(
        credential_ref,
        "inkpi.model.openai-chatgpt-plan.account"
            | "inkpi.model.openai-chatgpt-plan.host"
            | "inkpi.model.openai-chatgpt-plan.pending"
            | "inkpi.model.openai-chatgpt-plan.enabled"
    )
}

fn success_response() -> CredentialResponse {
    CredentialResponse {
        credential: None,
        success: true,
        error: None,
    }
}

fn error_response(message: &'static str) -> CredentialResponse {
    CredentialResponse {
        credential: None,
        success: false,
        error: Some(message),
    }
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
    use super::{
        constant_time_eq, format_chunk_manifest, is_chatgpt_plan_credential_ref,
        is_model_credential_ref, parse_chunk_manifest, resolve_request, split_utf8, ChunkManifest,
        MAX_CREDENTIAL_CHUNK_BYTES,
    };

    #[test]
    fn credential_references_are_limited_to_the_model_namespace() {
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
            r#"{"token":"wrong","operation":"get","credential_ref":"inkpi.model.openai.gpt-4o"}"#,
            "expected-token",
        );
        assert!(!response.success);
        assert_eq!(response.credential, None);
        assert_eq!(response.error, Some("unauthorized"));
    }

    #[test]
    fn rejects_references_outside_the_model_namespace() {
        let response = resolve_request(
            r#"{"token":"expected-token","operation":"get","credential_ref":"inkpi.other.secret"}"#,
            "expected-token",
        );
        assert!(!response.success);
        assert_eq!(response.error, Some("invalid credential reference"));
    }

    #[test]
    fn runtime_writes_are_limited_to_chatgpt_plan_references() {
        assert!(is_chatgpt_plan_credential_ref(
            "inkpi.model.openai-chatgpt-plan.account"
        ));
        assert!(is_chatgpt_plan_credential_ref(
            "inkpi.model.openai-chatgpt-plan.enabled"
        ));
        assert!(is_chatgpt_plan_credential_ref(
            "inkpi.model.openai-chatgpt-plan.host"
        ));
        assert!(is_chatgpt_plan_credential_ref(
            "inkpi.model.openai-chatgpt-plan.pending"
        ));
        assert!(!is_chatgpt_plan_credential_ref("inkpi.model.openai.gpt-4o"));
        let response = resolve_request(
            r#"{"token":"expected-token","operation":"set","credential_ref":"inkpi.model.openai.gpt-4o","value":"replacement"}"#,
            "expected-token",
        );
        assert!(!response.success);
        assert_eq!(
            response.error,
            Some("credential writes are limited to ChatGPT plan references")
        );
    }

    #[test]
    fn chunks_large_unicode_values_only_at_utf8_boundaries() {
        let value = "墨".repeat(900);
        let chunks = split_utf8(&value);
        assert!(chunks.len() > 1);
        assert!(chunks
            .iter()
            .all(|chunk| chunk.len() <= MAX_CREDENTIAL_CHUNK_BYTES));
        assert_eq!(chunks.concat(), value);
    }

    #[test]
    fn validates_chunk_manifests_before_reading_chunks() {
        let manifest = ChunkManifest {
            generation: "0123456789abcdef0123456789abcdef".to_string(),
            count: 2,
            byte_length: 3000,
        };
        let encoded = format_chunk_manifest(&manifest);
        assert_eq!(parse_chunk_manifest(&encoded), Some(manifest));
        assert_eq!(parse_chunk_manifest("inkpi-chunks-v1:bad:999:999999"), None);
    }
}
