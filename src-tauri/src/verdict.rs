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
    #[error("verdict must be exactly a JSON object, not surrounded by prose or fences: {0}")]
    NotStrictJson(String),
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
        return Err(VerdictParseError::NotStrictJson(
            "must start with '{' and end with '}'".to_string(),
        ));
    }
    match serde_json::from_str::<Verdict>(trimmed) {
        Ok(v) => Ok(v),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("unknown variant") {
                Err(VerdictParseError::UnknownKind(msg))
            } else {
                Err(VerdictParseError::MalformedJson(msg))
            }
        }
    }
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
            Err(VerdictParseError::NotStrictJson(_))
        ));
    }

    #[test]
    fn rejects_code_fenced() {
        assert!(matches!(
            parse_strict("```json\n{\"verdict\":\"approve\",\"reason\":\"ok\"}\n```"),
            Err(VerdictParseError::NotStrictJson(_))
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
}
