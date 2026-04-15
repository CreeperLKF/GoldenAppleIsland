use crate::ws::HookEvent;

#[derive(Debug, Clone, Copy)]
pub enum Decision {
    Approve,
    Deny,
    Observed,
}

#[derive(Debug, Clone, Copy)]
pub enum DecisionSource {
    User,
    Policy,
    Force,
    Auto,
}

pub async fn record_blocking(
    _event: &HookEvent,
    _decision: Decision,
    _source: DecisionSource,
    _answer: Option<String>,
) {
    // Stub — real implementation lands in Task 12.
}

pub async fn record_observational(_event: &HookEvent) {
    // Stub — real implementation lands in Task 12.
}
