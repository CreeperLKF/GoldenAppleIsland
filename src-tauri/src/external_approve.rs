use std::time::Duration;

use serde::Serialize;

use crate::verdict::{self, Verdict, VerdictParseError};
use crate::ws::HookEvent;

#[derive(Debug, thiserror::Error)]
pub enum ExternalCallError {
    #[error("external endpoint is not configured")]
    NotConfigured,
    #[error("malformed URL: {0}")]
    BadUrl(String),
    #[error("malformed auth header (expected 'Name: value'): {0}")]
    BadAuthHeader(String),
    #[error("request failed: {0}")]
    RequestFailed(String),
    #[error("external timed out after {0}s")]
    Timeout(u32),
    #[error("external returned HTTP {0}: {1}")]
    HttpError(u16, String),
    #[error("malformed verdict: {0}")]
    MalformedVerdict(String),
}

#[derive(Debug, Serialize)]
pub struct ExternalRequest<'a> {
    pub id: &'a str,
    pub session_id: &'a str,
    pub session_cwd: &'a str,
    pub source_distro: &'a str,
    pub tool_name: &'a str,
    pub tool_input: &'a serde_json::Value,
    pub timestamp: &'a str,
}

pub fn build_request<'a>(event: &'a HookEvent) -> ExternalRequest<'a> {
    ExternalRequest {
        id: &event.id,
        session_id: &event.session_id,
        session_cwd: &event.session_cwd,
        source_distro: &event.source_distro,
        tool_name: &event.tool_name,
        tool_input: &event.tool_input,
        timestamp: &event.timestamp,
    }
}

pub async fn run_external_call(
    url: &str,
    auth_header: Option<&str>,
    event: &HookEvent,
    call_timeout_secs: u32,
) -> Result<Verdict, ExternalCallError> {
    if url.is_empty() {
        return Err(ExternalCallError::NotConfigured);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(call_timeout_secs as u64))
        .build()
        .map_err(|e| ExternalCallError::RequestFailed(e.to_string()))?;

    let mut req = client.post(url).json(&build_request(event));
    if let Some(h) = auth_header {
        let (name, value) = split_header(h)?;
        req = req.header(name, value);
    }

    let resp = match req.send().await {
        Ok(r) => r,
        Err(e) if e.is_timeout() => return Err(ExternalCallError::Timeout(call_timeout_secs)),
        Err(e) => return Err(ExternalCallError::RequestFailed(e.to_string())),
    };

    if !resp.status().is_success() {
        let code = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        let snippet: String = body.chars().take(200).collect();
        return Err(ExternalCallError::HttpError(code, snippet));
    }

    let text = resp
        .text()
        .await
        .map_err(|e| ExternalCallError::RequestFailed(e.to_string()))?;
    verdict::parse_strict(&text).map_err(|e| match e {
        VerdictParseError::NotStrictJson => {
            ExternalCallError::MalformedVerdict("not strict JSON".into())
        }
        VerdictParseError::MalformedJson(m) | VerdictParseError::UnknownKind(m) => {
            ExternalCallError::MalformedVerdict(m)
        }
        VerdictParseError::Empty => ExternalCallError::MalformedVerdict("empty".into()),
    })
}

pub fn split_header(h: &str) -> Result<(String, String), ExternalCallError> {
    let (name, value) = h
        .split_once(':')
        .ok_or_else(|| ExternalCallError::BadAuthHeader(h.to_string()))?;
    let name = name.trim().to_string();
    let value = value.trim().to_string();
    if name.is_empty() {
        return Err(ExternalCallError::BadAuthHeader(h.to_string()));
    }
    Ok((name, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_header_parses() {
        let (n, v) = split_header("Authorization: Bearer abc").unwrap();
        assert_eq!(n, "Authorization");
        assert_eq!(v, "Bearer abc");
    }

    #[test]
    fn split_header_rejects_missing_colon() {
        assert!(matches!(
            split_header("no-colon"),
            Err(ExternalCallError::BadAuthHeader(_))
        ));
    }
}
