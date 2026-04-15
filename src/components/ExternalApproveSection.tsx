import { useEffect, useState } from "react";
import { useExternalConfig } from "../hooks/useExternalConfig";

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
    <section
      id="external-approve-section"
      className="flex flex-col"
      style={{
        padding: "12px 16px",
        gap: 10,
        borderTop: "0.5px solid var(--border)",
      }}
    >
      <h2
        className="font-semibold text-[var(--text-primary)]"
        style={{ fontSize: 13, margin: 0 }}
      >
        External Approve{" "}
        <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
          (experimental)
        </span>
      </h2>
      <div className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
        Delegate approvals to an HTTP endpoint you control.
      </div>

      {/* Endpoint URL */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}
        >
          Endpoint URL
        </span>
        <input
          type="text"
          placeholder="https://example.com/approve"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onBlur={() => void commitUrl()}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "2px 6px",
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: 3,
            color: "var(--text-primary)",
          }}
        />
      </div>
      {urlError && (
        <div
          style={{
            fontSize: 11,
            color: "var(--deny-text)",
            paddingLeft: 118,
          }}
        >
          {urlError}
        </div>
      )}

      {/* Auth header */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          style={{ width: 110, fontSize: 12, color: "var(--text-secondary)" }}
        >
          Auth header
        </span>
        <input
          type="text"
          placeholder="Authorization: Bearer xxx"
          value={authInput}
          onChange={(e) => setAuthInput(e.target.value)}
          onBlur={() => void commitAuth()}
          style={{
            flex: 1,
            fontSize: 12,
            padding: "2px 6px",
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: 3,
            color: "var(--text-primary)",
          }}
        />
      </div>
      {authError && (
        <div
          style={{
            fontSize: 11,
            color: "var(--deny-text)",
            paddingLeft: 118,
          }}
        >
          {authError}
        </div>
      )}

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
          onBlur={() => void commitTimeout()}
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

      {/* Test endpoint */}
      <div className="flex items-center" style={{ gap: 8 }}>
        <span style={{ width: 110 }} />
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={testing || !config?.endpoint_url}
          style={{
            fontSize: 11,
            padding: "2px 8px",
            cursor:
              testing || !config?.endpoint_url ? "not-allowed" : "pointer",
            opacity: testing || !config?.endpoint_url ? 0.6 : 1,
          }}
        >
          {testing ? "Testing…" : "Test endpoint"}
        </button>
        {lastTest && lastTest.ok && (
          <span
            style={{
              fontSize: 11,
              color: "var(--approve-text)",
              fontFamily: "monospace",
            }}
          >
            ✓ {lastTest.verdict} · {lastTest.elapsedMs.toFixed(0)}ms
          </span>
        )}
        {lastTest && !lastTest.ok && (
          <span
            style={{
              fontSize: 11,
              color: "var(--deny-text)",
              fontFamily: "monospace",
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
    </section>
  );
}
