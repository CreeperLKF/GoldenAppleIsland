use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Slot {
    ToggleWindow,
    ApproveAll,
}

impl Slot {
    pub fn from_str_snake(s: &str) -> Option<Self> {
        match s {
            "toggle_window" => Some(Slot::ToggleWindow),
            "approve_all" => Some(Slot::ApproveAll),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slot_round_trips_through_snake_case() {
        assert_eq!(Slot::from_str_snake("toggle_window"), Some(Slot::ToggleWindow));
        assert_eq!(Slot::from_str_snake("approve_all"), Some(Slot::ApproveAll));
        assert_eq!(Slot::from_str_snake("bogus"), None);
    }

    #[test]
    fn slot_serde_snake_case() {
        let json = serde_json::to_string(&Slot::ToggleWindow).unwrap();
        assert_eq!(json, "\"toggle_window\"");
        let parsed: Slot = serde_json::from_str("\"approve_all\"").unwrap();
        assert_eq!(parsed, Slot::ApproveAll);
    }
}
