import type { PolicyKind } from "../../types/events";

export type DropdownValue = PolicyKind | "inherit";

interface Props {
  value: DropdownValue;
  allowInherit: boolean;
  onChange: (next: DropdownValue) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
  disabled?: boolean;
  labels?: {
    auto?: string;
    manual?: string;
    agent?: string;
    external?: string;
    inherit?: string;
  };
  /**
   * Whether the Agent Approve policy is configured (workspace_path set).
   * When false, the Agent option is rendered disabled. Default: true.
   */
  agentConfigured?: boolean;
  /**
   * Whether the External Approve policy is configured (endpoint_url set).
   * When false, the External option is rendered disabled. Default: true.
   */
  externalConfigured?: boolean;
  /**
   * Invoked when the user selects a disabled Agent/External option instead
   * of the value changing. Call sites use this to open settings or scroll
   * to the relevant subsection.
   */
  onRequestConfigure?: (which: "agent" | "external") => void;
}

export default function PolicyDropdown({
  value,
  allowInherit,
  onChange,
  size = "md",
  ariaLabel,
  disabled = false,
  labels,
  agentConfigured = true,
  externalConfigured = true,
  onRequestConfigure,
}: Props) {
  const height = size === "sm" ? 20 : 24;
  const fontSize = size === "sm" ? 11 : 12;
  const autoLabel = labels?.auto ?? "Force Auto";
  const manualLabel = labels?.manual ?? "Force Manual";
  const agentLabel = labels?.agent ?? "Agent";
  const externalLabel = labels?.external ?? "External";
  const inheritLabel = labels?.inherit ?? "Use inherited";

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as DropdownValue;
    if (next === "agent" && !agentConfigured) {
      e.target.value = value;
      onRequestConfigure?.("agent");
      return;
    }
    if (next === "external" && !externalConfigured) {
      e.target.value = value;
      onRequestConfigure?.("external");
      return;
    }
    onChange(next);
  };

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={handleChange}
      className="rounded bg-[var(--bg-surface)] text-[var(--text-primary)] hover:brightness-95 disabled:opacity-40"
      style={{
        height,
        fontSize,
        padding: "0 6px",
        borderWidth: "0.5px",
        borderStyle: "solid",
        borderColor: "var(--border)",
      }}
    >
      {allowInherit && <option value="inherit">{inheritLabel}</option>}
      <option value="auto">{autoLabel}</option>
      <option value="manual">{manualLabel}</option>
      <option
        value="agent"
        title={
          !agentConfigured
            ? "Configure in Settings → Approval Policies → Agent Approve"
            : undefined
        }
      >
        {agentLabel} (experimental)
        {!agentConfigured ? " — not configured" : ""}
      </option>
      <option
        value="external"
        title={
          !externalConfigured
            ? "Configure in Settings → Approval Policies → External Approve"
            : undefined
        }
      >
        {externalLabel} (experimental)
        {!externalConfigured ? " — not configured" : ""}
      </option>
    </select>
  );
}
