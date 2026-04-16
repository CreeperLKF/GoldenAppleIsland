import { useEffect, useState } from "react";
import { useExternalConfig } from "../hooks/useExternalConfig";
import Button from "./ui/Button";
import StatRow from "./ui/StatRow";

function isValidUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function ExternalApproveSection() {
  const {
    config,
    lastTest,
    setEndpointUrl,
    setAuthHeader,
    setTimeout: setCallTimeout,
    test,
  } = useExternalConfig();

  const [urlInput, setUrlInput] = useState<string>("");
  const [authInput, setAuthInput] = useState<string>("");
  const [timeoutInput, setTimeoutInput] = useState<string>("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (config) {
      setUrlInput(config.endpoint_url ?? "");
      setAuthInput(config.auth_header ?? "");
      setTimeoutInput(String(config.call_timeout_secs ?? 30));
    }
  }, [config?.endpoint_url, config?.auth_header, config?.call_timeout_secs]);

  const commitUrl = async () => {
    const v = urlInput.trim();
    if (v === "") {
      setUrlError(null);
      await setEndpointUrl("");
      return;
    }
    if (!isValidUrl(v)) {
      setUrlError("Not a valid URL");
      return;
    }
    setUrlError(null);
    if (v !== (config?.endpoint_url ?? "")) {
      await setEndpointUrl(v);
    }
  };

  const commitAuth = async () => {
    const v = authInput;
    if (v !== "" && !v.includes(":")) {
      setAuthError('Expected "Name: value"');
      return;
    }
    setAuthError(null);
    if (v !== (config?.auth_header ?? "")) {
      await setAuthHeader(v);
    }
  };

  const commitTimeout = async () => {
    const n = parseInt(timeoutInput, 10);
    if (Number.isFinite(n) && n >= 5 && n !== config?.call_timeout_secs) {
      await setCallTimeout(n);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      await test();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      id="external-approve-section"
      className="flex flex-col"
      style={{ gap: 10 }}
    >
      <div style={{ fontSize: "var(--fs-small)", color: "var(--text-tertiary)" }}>
        Delegate approvals to an HTTP endpoint you control.
      </div>

      {/* Endpoint URL */}
      <StatRow
        label="Endpoint URL"
        value={
          <input
            type="text"
            placeholder="https://example.com/approve"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onBlur={() => void commitUrl()}
            style={{
              width: "100%",
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
      {urlError && (
        <div style={{ fontSize: "var(--fs-small)", color: "var(--sem-deny)", paddingLeft: 132 }}>
          {urlError}
        </div>
      )}

      {/* Auth header */}
      <StatRow
        label="Auth header"
        value={
          <input
            type="text"
            placeholder="Authorization: Bearer xxx"
            value={authInput}
            onChange={(e) => setAuthInput(e.target.value)}
            onBlur={() => void commitAuth()}
            style={{
              width: "100%",
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
      {authError && (
        <div style={{ fontSize: "var(--fs-small)", color: "var(--sem-deny)", paddingLeft: 132 }}>
          {authError}
        </div>
      )}

      {/* Call timeout */}
      <StatRow
        label="Call timeout (s)"
        value={
          <input
            type="number"
            min={5}
            value={timeoutInput}
            onChange={(e) => setTimeoutInput(e.target.value)}
            onBlur={() => void commitTimeout()}
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

      {/* Test endpoint */}
      <StatRow
        label=""
        value={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {lastTest && lastTest.ok && (
              <span
                style={{
                  fontSize: "var(--fs-small)",
                  color: "var(--sem-approve)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ✓ {lastTest.verdict} · {lastTest.elapsedMs.toFixed(0)}ms
              </span>
            )}
            {lastTest && !lastTest.ok && (
              <span
                style={{
                  fontSize: "var(--fs-small)",
                  color: "var(--sem-deny)",
                  fontFamily: "var(--font-mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={lastTest.error}
              >
                ✗ {lastTest.error}
              </span>
            )}
          </div>
        }
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void runTest()}
            disabled={testing || !config?.endpoint_url}
          >
            {testing ? "Testing…" : "Test endpoint"}
          </Button>
        }
      />
    </div>
  );
}
