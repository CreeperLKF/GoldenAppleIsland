import { useWslDistros } from "../hooks/useWslDistros";
import Toggle from "./ui/Toggle";
import Button from "./ui/Button";
import type { WslDistroWithStatus } from "../types/settings";
import { EMPTY_CUSTOM, type HookTargetConfig } from "../types/modes";
import { useAppSettings } from "../hooks/useAppSettings";
import HookModeDropdown from "./HookModeDropdown";

export default function WslInstancesSection() {
  const { distros, loading, error, busy, updating, refresh, checkDistro, setEnabled, setAll, updateScripts, setConfig } =
    useWslDistros();
  const { settings, update: updateSettings } = useAppSettings();

  return (
    <section className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 6 }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={updateScripts}
            disabled={loading || updating || distros.length === 0}
          >
            {updating ? "Updating…" : "Update scripts"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAll(true)}
            disabled={loading || distros.length === 0}
          >
            Enable all
          </Button>
          <Button
            variant="secondary"
            tone="danger"
            size="sm"
            onClick={() => setAll(false)}
            disabled={loading || distros.length === 0}
          >
            Disable all
          </Button>
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

      <ul className="flex flex-col" style={{ gap: 6, listStyle: "none", margin: 0, padding: 0 }}>
        {distros.map((d) => (
          <DistroRow
            key={d.name}
            distro={d}
            config={settings?.wsl_hook_configs?.[d.name] ?? {
              mode: settings?.default_mode ?? "audit",
              custom: EMPTY_CUSTOM,
            }}
            onConfigChange={async (next: HookTargetConfig) => {
              await setConfig(d.name, next);
              await updateSettings({});
            }}
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
  config,
  onConfigChange,
  busy,
  onToggle,
  onCheck,
}: {
  distro: WslDistroWithStatus;
  config: HookTargetConfig;
  onConfigChange: (next: HookTargetConfig) => void;
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
      style={{
        background: "var(--bg-elevated)",
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Row 1: name + badges */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
          <span
            className="text-[var(--text-primary)]"
            style={{ fontSize: "var(--fs-body)", fontWeight: 500 }}
          >
            {name}
          </span>
          {is_default && (
            <span
              className="rounded"
              style={{
                fontSize: "var(--fs-small)",
                padding: "1px 6px",
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                border: "0.5px solid var(--border)",
              }}
            >
              default
            </span>
          )}
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--fs-small)" }}>
            WSL{version}
          </span>
          <span
            className="rounded"
            style={{
              fontSize: "var(--fs-small)",
              padding: "1px 6px",
              background: isRunning ? "var(--approve-bg)" : "var(--bg-surface)",
              color: isRunning ? "var(--approve-text)" : "var(--text-tertiary)",
              border: "0.5px solid var(--border)",
            }}
          >
            {state}
          </span>
        </div>
      </div>
      {/* Row 2: status + controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-small)", color: statusColor, flex: 1 }}>{statusLabel}</span>
        {!isRunning && (
          <button
            type="button"
            onClick={onCheck}
            disabled={busy}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            style={{ fontSize: "var(--fs-small)", textDecoration: "underline" }}
          >
            Check
          </button>
        )}
        <HookModeDropdown
          config={config}
          onChange={(next) => onConfigChange(next)}
          disabled={busy}
        />
        {busy && (
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: "var(--fs-small)" }}>
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
