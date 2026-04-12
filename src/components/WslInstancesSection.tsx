import { useWslDistros } from "../hooks/useWslDistros";
import Toggle from "./ui/Toggle";
import type { WslDistroWithStatus } from "../types/settings";

export default function WslInstancesSection() {
  const { distros, loading, error, busy, updating, refresh, checkDistro, setEnabled, setAll, updateScripts } =
    useWslDistros();

  return (
    <section className="flex flex-col" style={{ padding: "12px 16px", gap: 10 }}>
      <div className="flex items-center justify-between">
        <h2
          className="font-semibold text-[var(--text-primary)]"
          style={{ fontSize: 13, margin: 0 }}
        >
          WSL Instances
        </h2>
        <div className="flex items-center" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={refresh}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            style={{ fontSize: 11 }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={updateScripts}
            disabled={loading || updating || distros.length === 0}
            className="rounded border hover:brightness-95 disabled:opacity-40"
            style={{
              fontSize: 11,
              height: 22,
              padding: "0 8px",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
              background: "var(--bg-elevated)",
            }}
          >
            {updating ? "Updating…" : "Update scripts"}
          </button>
          <button
            type="button"
            onClick={() => setAll(true)}
            disabled={loading || distros.length === 0}
            className="rounded border hover:brightness-95 disabled:opacity-40"
            style={{
              fontSize: 11,
              height: 22,
              padding: "0 8px",
              borderColor: "var(--border)",
              color: "var(--approve-text)",
              background: "var(--approve-bg)",
            }}
          >
            Enable all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            disabled={loading || distros.length === 0}
            className="rounded border hover:brightness-95 disabled:opacity-40"
            style={{
              fontSize: 11,
              height: 22,
              padding: "0 8px",
              borderColor: "var(--border)",
              color: "var(--deny-text)",
              background: "var(--deny-bg)",
            }}
          >
            Disable all
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>
          Loading WSL instances…
        </div>
      )}

      {error && (
        <div
          className="rounded"
          style={{
            fontSize: 12,
            padding: "8px 10px",
            background: "var(--deny-bg)",
            color: "var(--deny-text)",
            border: "0.5px solid var(--deny-text)",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && distros.length === 0 && (
        <div className="text-[var(--text-tertiary)]" style={{ fontSize: 12 }}>
          No WSL distributions detected. Install a Linux distro from the
          Microsoft Store or run <code>wsl --install</code>.
        </div>
      )}

      <ul className="flex flex-col" style={{ gap: 6 }}>
        {distros.map((d) => (
          <DistroRow
            key={d.name}
            distro={d}
            busy={busy.has(d.name)}
            onToggle={(next) => setEnabled(d.name, next)}
            onCheck={() => checkDistro(d.name)}
          />
        ))}
      </ul>
    </section>
  );
}

function DistroRow({
  distro,
  busy,
  onToggle,
  onCheck,
}: {
  distro: WslDistroWithStatus;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onCheck: () => void;
}) {
  const { name, is_default, version, state, status } = distro;
  const isRunning = state === "Running";
  const enabled = status.registered;
  const statusLabel = enabled
    ? status.scripts_installed
      ? "Registered"
      : "Registered (scripts missing)"
    : status.scripts_installed
      ? "Scripts installed, not registered"
      : "Not registered";
  const statusColor = enabled ? "var(--approve-text)" : "var(--text-tertiary)";

  return (
    <li
      className="flex items-center justify-between bg-[var(--bg-surface)]"
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        border: "0.5px solid var(--border)",
        gap: 12,
      }}
    >
      <div className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            {name}
          </span>
          {is_default && (
            <span
              className="rounded"
              style={{
                fontSize: 10,
                padding: "1px 6px",
                background: "var(--bg-elevated)",
                color: "var(--text-secondary)",
                border: "0.5px solid var(--border)",
              }}
            >
              default
            </span>
          )}
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            WSL{version}
          </span>
          <span
            className="rounded"
            style={{
              fontSize: 10,
              padding: "1px 6px",
              background: isRunning ? "var(--approve-bg)" : "var(--bg-elevated)",
              color: isRunning ? "var(--approve-text)" : "var(--text-tertiary)",
              border: "0.5px solid var(--border)",
            }}
          >
            {state}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 6 }}>
          <span style={{ fontSize: 11, color: statusColor }}>{statusLabel}</span>
          {!isRunning && (
            <button
              type="button"
              onClick={onCheck}
              disabled={busy}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
              style={{ fontSize: 10, textDecoration: "underline" }}
            >
              Check
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 8 }}>
        {busy && (
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            …
          </span>
        )}
        <Toggle
          checked={enabled}
          onChange={onToggle}
          disabled={busy}
          ariaLabel={`${enabled ? "Disable" : "Enable"} hook on ${name}`}
        />
      </div>
    </li>
  );
}
