import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useAgentConfig } from "../hooks/useAgentConfig";

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
    <section
      id="agent-approve-section"
      className="flex flex-col"
      style={{ padding: "12px 16px", gap: 10, borderTop: "0.5px solid var(--border)" }}
    >
      <h2
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 13, margin: 0 }}
      >
        Agent Approve <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(experimental)</span>
      </h2>
      <div className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
        Delegate tool-use approvals to a headless Claude Code agent running in a
        dedicated workspace.
      </div>

      {!configured && (
        <div className="flex flex-col" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={() => void createDefault()}
            disabled={busy}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              alignSelf: "flex-start",
              background: "var(--accent-green-dark)",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 4,
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Creating…" : "Create default workspace"}
          </button>
          {error && (
            <div
              className="flex items-center"
              style={{ gap: 8, fontSize: 11, color: "var(--deny-text)" }}
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => void createDefault()}
                style={{ fontSize: 11, padding: "2px 6px" }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {configured && (
        <>
          {/* Workspace path row */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}
            >
              Workspace
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={config!.workspace_path ?? ""}
            >
              {config!.workspace_path}
            </span>
            <button
              type="button"
              onClick={() => void pickWorkspace()}
              style={{ fontSize: 12, padding: "2px 8px" }}
            >
              Browse…
            </button>
          </div>

          {/* Status row */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ width: 110 }} />
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: config!.is_default_workspace
                  ? "var(--accent-green)"
                  : "var(--accent-amber)",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>
              {config!.is_default_workspace
                ? "Using default workspace"
                : "Custom workspace"}
            </span>
            {config!.is_default_workspace ? (
              <button
                type="button"
                onClick={() => void confirmReset()}
                disabled={busy}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  color: "var(--deny-text)",
                }}
              >
                Reset workspace
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void useDefaultInstead()}
                disabled={busy}
                style={{ fontSize: 11, padding: "2px 8px" }}
              >
                Use default instead
              </button>
            )}
          </div>

          {!config!.is_default_workspace && (
            <div
              style={{
                fontSize: 11,
                color: "var(--badge-permission-text)",
                paddingLeft: 118,
              }}
            >
              Make sure this workspace has no hooks pointing back to GAI, or you
              may deadlock.
            </div>
          )}

          {error && (
            <div
              style={{
                fontSize: 11,
                color: "var(--deny-text)",
                paddingLeft: 118,
              }}
            >
              {error}
            </div>
          )}

          {/* Turn limit */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}
            >
              Turn limit
            </span>
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
                fontSize: 12,
                padding: "2px 6px",
                background: "var(--bg-surface)",
                border: "0.5px solid var(--border)",
                borderRadius: 3,
                color: "var(--text-primary)",
              }}
            />
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Reset the agent session after this many calls
            </span>
          </div>

          {/* Call timeout */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}
            >
              Call timeout (s)
            </span>
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
                fontSize: 12,
                padding: "2px 6px",
                background: "var(--bg-surface)",
                border: "0.5px solid var(--border)",
                borderRadius: 3,
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Session row */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <span style={{ width: 110 }} />
            <button
              type="button"
              onClick={() => void resetSession()}
              style={{ fontSize: 11, padding: "2px 8px" }}
            >
              Reset agent session now
            </button>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontFamily: "monospace",
              }}
            >
              {session
                ? `Session: ${session.session_id.slice(0, 10)}… · ${session.turn_count}/${config!.turn_limit} turns`
                : "No active session"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
