use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VerdictKind {
    Approve,
    Reject,
    Escalate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verdict {
    pub verdict: VerdictKind,
    #[serde(default)]
    pub reason: String,
}

#[derive(Debug, thiserror::Error)]
pub enum VerdictParseError {
    #[error("verdict text is empty")]
    Empty,
    #[error("verdict must be exactly a JSON object, not surrounded by prose or fences")]
    NotStrictJson,
    #[error("malformed verdict JSON: {0}")]
    MalformedJson(String),
    #[error("unknown verdict kind: {0}")]
    UnknownKind(String),
}

/// Strict: accepts exactly one JSON object, no leading/trailing text, no fences.
pub fn parse_strict(s: &str) -> Result<Verdict, VerdictParseError> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return Err(VerdictParseError::Empty);
    }
    if !trimmed.starts_with('{') || !trimmed.ends_with('}') {
        return Err(VerdictParseError::NotStrictJson);
    }
    let value: serde_json::Value = serde_json::from_str(trimmed)
        .map_err(|e| VerdictParseError::MalformedJson(e.to_string()))?;
    let obj = value.as_object()
        .ok_or_else(|| VerdictParseError::MalformedJson("expected a JSON object".to_string()))?;
    let verdict_str = obj.get("verdict")
        .and_then(|v| v.as_str())
        .ok_or_else(|| VerdictParseError::MalformedJson("missing 'verdict' field".to_string()))?;
    let verdict_kind = match verdict_str {
        "approve" => VerdictKind::Approve,
        "reject" => VerdictKind::Reject,
        "escalate" => VerdictKind::Escalate,
        other => return Err(VerdictParseError::UnknownKind(other.to_string())),
    };
    let reason = obj.get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(Verdict { verdict: verdict_kind, reason })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_approve() {
        let v = parse_strict(r#"{"verdict":"approve","reason":"looks fine"}"#).unwrap();
        assert_eq!(v.verdict, VerdictKind::Approve);
        assert_eq!(v.reason, "looks fine");
    }

    #[test]
    fn parses_reject() {
        let v = parse_strict(r#"{"verdict":"reject","reason":"rm -rf"}"#).unwrap();
        assert_eq!(v.verdict, VerdictKind::Reject);
    }

    #[test]
    fn parses_escalate() {
        let v = parse_strict(r#"{"verdict":"escalate","reason":"sensitive"}"#).unwrap();
        assert_eq!(v.verdict, VerdictKind::Escalate);
    }

    #[test]
    fn rejects_prose_wrapped() {
        assert!(matches!(
            parse_strict("Sure! {\"verdict\":\"approve\",\"reason\":\"ok\"}"),
            Err(VerdictParseError::NotStrictJson)
        ));
    }

    #[test]
    fn rejects_code_fenced() {
        assert!(matches!(
            parse_strict("```json\n{\"verdict\":\"approve\",\"reason\":\"ok\"}\n```"),
            Err(VerdictParseError::NotStrictJson)
        ));
    }

    #[test]
    fn rejects_unknown_kind() {
        assert!(matches!(
            parse_strict(r#"{"verdict":"maybe","reason":"huh"}"#),
            Err(VerdictParseError::UnknownKind(_))
        ));
    }

    #[test]
    fn rejects_empty() {
        assert!(matches!(parse_strict("   "), Err(VerdictParseError::Empty)));
    }

    #[test]
    fn reason_defaults_to_empty_string() {
        let v = parse_strict(r#"{"verdict":"approve"}"#).unwrap();
        assert_eq!(v.reason, "");
    }

    #[test]
    fn unknown_kind_carries_literal_string() {
        match parse_strict(r#"{"verdict":"maybe","reason":"huh"}"#) {
            Err(VerdictParseError::UnknownKind(s)) => assert_eq!(s, "maybe"),
            other => panic!("expected UnknownKind(\"maybe\"), got {:?}", other),
        }
    }
}
