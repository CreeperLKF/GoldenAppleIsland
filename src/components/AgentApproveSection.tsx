import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgentConfig } from "../hooks/useAgentConfig";
import Button from "./ui/Button";
import StatRow from "./ui/StatRow";

export default function AgentApproveSection() {
  const {
    config,
    session,
    busy,
    error,
    createDefault,
    resetDefault,
    setWorkspacePath,
    setTurnLimit,
    setTimeout: setCallTimeout,
    resetSession,
  } = useAgentConfig();

  const [turnLimitInput, setTurnLimitInput] = useState<string>("");
  const [timeoutInput, setTimeoutInput] = useState<string>("");

  useEffect(() => {
    if (config) {
      setTurnLimitInput(String(config.turn_limit));
      setTimeoutInput(String(config.call_timeout_secs));
    }
  }, [config?.turn_limit, config?.call_timeout_secs]);

  const pickWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: config?.workspace_path ?? undefined,
      });
      if (typeof selected === "string" && selected.length > 0) {
        await setWorkspacePath(selected);
      }
    } catch (e) {
      console.error("pickWorkspace failed", e);
    }
  };

  const confirmReset = async () => {
    if (!config?.workspace_path) return;
    const ok = window.confirm(
      `This will delete ${config.workspace_path} and re-download CLAUDE.md. Continue?`,
    );
    if (ok) await resetDefault();
  };

  const useDefaultInstead = async () => {
    await createDefault();
  };

  const configured = config?.workspace_path != null;

  return (
    <div
      id="agent-approve-section"
      className="flex flex-col"
      style={{ gap: 10 }}
    >
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
        Delegate tool-use approvals to a headless Claude Code agent running in a
        dedicated workspace.
      </div>

      {!configured && (
        <div className="flex flex-col" style={{ gap: 6 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void createDefault()}
            disabled={busy}
            style={{ alignSelf: "flex-start" }}
          >
            {busy ? "Creating…" : "Create default workspace"}
          </Button>
          {error && (
            <div
              className="flex items-center"
              style={{ gap: 8, fontSize: "var(--fs-small)", color: "var(--sem-deny)" }}
            >
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={() => void createDefault()}>
                Retry
              </Button>
            </div>
          )}
        </div>
      )}

      {configured && (
        <>
          {/* Workspace path row */}
          <StatRow
            label="Workspace"
            mono
            value={config!.workspace_path ?? ""}
            action={
              <Button variant="secondary" size="sm" onClick={() => void pickWorkspace()}>
                Browse…
              </Button>
            }
          />

          {/* Status row */}
          <StatRow
            label="Status"
            value={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: config!.is_default_workspace
                      ? "var(--accent-green)"
                      : "var(--accent-amber)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: "var(--fs-small)", color: "var(--text-secondary)" }}>
                  {config!.is_default_workspace
                    ? "Using default workspace"
                    : "Custom workspace"}
                </span>
              </span>
            }
            action={
              config!.is_default_workspace ? (
                <Button
                  variant="secondary"
                  tone="danger"
                  size="sm"
                  onClick={() => void confirmReset()}
                  disabled={busy}
                >
                  Reset workspace
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void useDefaultInstead()}
                  disabled={busy}
                >
                  Use default instead
                </Button>
              )
            }
          />

          {!config!.is_default_workspace && (
            <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)", paddingLeft: 132 }}>
              Make sure this workspace has no hooks pointing back to GAI, or you
              may deadlock.
            </div>
          )}

          {error && (
            <div style={{ fontSize: "var(--fs-small)", color: "var(--sem-deny)", paddingLeft: 132 }}>
              {error}
            </div>
          )}

          {/* Turn limit */}
          <StatRow
            label="Turn limit"
            value={
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min={1}
                  value={turnLimitInput}
                  onChange={(e) => setTurnLimitInput(e.target.value)}
                  onBlur={() => {
                    const n = parseInt(turnLimitInput, 10);
                    if (Number.isFinite(n) && n >= 1 && n !== config!.turn_limit) {
                      void setTurnLimit(n);
                    }
                  }}
                  style={{
                    width: 80,
                    fontSize: "var(--fs-small)",
                    padding: "2px 6px",
                    background: "var(--bg-surface)",
                    border: "0.5px solid var(--border)",
                    borderRadius: 3,
                    color: "var(--text-primary)",
                  }}
                />
                <span style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
                  Reset the agent session after this many calls
                </span>
              </div>
            }
          />

          {/* Call timeout */}
          <StatRow
            label="Call timeout (s)"
            value={
              <input
                type="number"
                min={5}
                value={timeoutInput}
                onChange={(e) => setTimeoutInput(e.target.value)}
                onBlur={() => {
                  const n = parseInt(timeoutInput, 10);
                  if (
                    Number.isFinite(n) &&
                    n >= 5 &&
                    n !== config!.call_timeout_secs
                  ) {
                    void setCallTimeout(n);
                  }
                }}
                style={{
                  width: 80,
                  fontSize: "var(--fs-small)",
                  padding: "2px 6px",
                  background: "var(--bg-surface)",
                  border: "0.5px solid var(--border)",
                  borderRadius: 3,
                  color: "var(--text-primary)",
                }}
              />
            }
          />

          {/* Session row */}
          <StatRow
            label="Session"
            mono
            value={
              session
                ? `${session.session_id.slice(0, 10)}… · ${session.turn_count}/${config!.turn_limit} turns`
                : "No active session"
            }
            action={
              <Button variant="ghost" size="sm" onClick={() => void resetSession()}>
                Reset now
              </Button>
            }
          />
        </>
      )}
    </div>
  );
}
