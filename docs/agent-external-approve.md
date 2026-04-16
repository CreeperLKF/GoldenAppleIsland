# Agent Approve & External Approve

Golden Apple Island supports two experimental approval policies that delegate decisions to automated systems instead of requiring manual clicks.

| Policy | How it works |
|---|---|
| **Agent Approve** | Spawns a local Claude Code agent (`claude -p`) that reads the hook event and returns a verdict |
| **External Approve** | Sends the hook event as an HTTP POST to your endpoint and reads the verdict from the response |

Both can be used anywhere a policy kind is accepted: Override Policy, Session Policy, per-distribution rules, per-folder rules, and global defaults.

## Prerequisites

### Agent Approve

The Claude Code CLI must be on your Windows `PATH`. Both `claude.exe` and the npm-installed `claude.cmd` shim are supported (resolved via `which`). Golden Apple Island does not bundle or install Claude Code.

### External Approve

An HTTP(S) endpoint that accepts POST requests and returns JSON. No additional local dependencies.

## Agent Approve

### How it works

1. When a hook event arrives and the resolved policy is Agent Approve, Golden Apple Island builds a prompt describing the event (tool name, input, session, working directory).
2. It spawns `claude -p <prompt>` against a workspace directory. The workspace's `CLAUDE.md` guides the agent's decision-making.
3. The agent returns a JSON verdict: `approve`, `reject`, or `escalate`.
4. On `escalate`, the event falls through to manual review (a card appears in the popup).

### Session reuse

Agent Approve maintains a **singleton session** across multiple approval events. After the first call, subsequent calls use `claude -p --resume <session_id>` so the agent retains context from prior decisions. This means the agent can learn patterns from the current work session.

The session automatically **rolls over** (starts fresh) after reaching the turn limit (default: 20). You can also manually reset the session from Settings.

### Configuration

Open **Settings → Approval Policies → Agent Approve (experimental)**.

| Setting | Default | Description |
|---|---|---|
| Workspace path | `%APPDATA%\golden-apple-island\agent-workspaces\default\` | Directory containing the `CLAUDE.md` that guides the agent |
| Turn limit | 20 | Number of approval turns before the session resets |
| Call timeout | 60s | Maximum time to wait for the agent to respond |

### Default workspace (ALICE)

Click **"Create default workspace"** to bootstrap the built-in workspace. It downloads the [ALICE "all-is-well" profile](https://github.com/CreeperLKF/ALICE) — a lightweight safety reviewer that classifies operations on four dimensions:

- **Irreversibility** — can the action be undone?
- **Blast radius** — how many systems are affected?
- **Information flow** — does it leak or exfiltrate data?
- **Authorization scope** — does it exceed expected permissions?

ALICE approves clearly safe operations, rejects clearly dangerous ones, and escalates ambiguous cases to you. It is a starting point, not a security sandbox — customize the workspace `CLAUDE.md` for your own risk tolerance.

### Custom workspaces

Click **"Browse..."** to select any directory as the workspace. The agent runs against that directory's `CLAUDE.md`. You can tailor the instructions to your project, team conventions, or compliance requirements.

## External Approve

### How it works

1. When a hook event arrives and the resolved policy is External Approve, Golden Apple Island sends an HTTP POST to your configured endpoint.
2. Your endpoint processes the event and returns a JSON verdict.
3. On `escalate`, the event falls through to manual review.

### Request format

```http
POST <endpoint_url>
Content-Type: application/json
<auth_header if configured>

{
  "id": "evt_xxx",
  "session_id": "sess_abc",
  "session_cwd": "/home/user/project",
  "source_distro": "Ubuntu",
  "tool_name": "bash",
  "tool_input": { ... },
  "timestamp": "2026-04-16T10:30:00Z"
}
```

### Response format

Your endpoint must return strict JSON (no markdown fences, no prose wrapping):

```json
{
  "verdict": "approve",
  "reason": "optional explanation"
}
```

Valid `verdict` values: `approve`, `reject`, `escalate`.

### Configuration

Open **Settings → Approval Policies → External Approve (experimental)**.

| Setting | Default | Description |
|---|---|---|
| Endpoint URL | *(none)* | The HTTPS URL to POST hook events to |
| Auth header | *(none)* | Optional HTTP header for authentication (format: `Header-Name: value`, e.g. `Authorization: Bearer abc123`) |
| Call timeout | 30s | Maximum time to wait for the endpoint to respond |

Use the **"Test endpoint"** button to verify connectivity — it sends a test POST and shows the verdict, latency, or error.

## Using in the popup

Both policy kinds appear in the popup's policy panel:

- **Override Policy** (top row) — set to Agent or External to apply globally to all incoming events, regardless of session. Available even when no session is active.
- **Session Policy** (bottom row) — set to Agent or External for the currently active session only.

When Agent Approve or External Approve is not configured (no workspace path or no endpoint URL), their options appear greyed out and cannot be selected. Configure them in Settings first.

## Verdict behavior summary

| Verdict | Effect |
|---|---|
| `approve` | The tool call is approved; the session unblocks |
| `reject` | The tool call is denied; the session receives a rejection |
| `escalate` | Falls through to manual review — an approval card appears in the popup |

## Timeouts and errors

If the agent or endpoint does not respond within the configured timeout, or returns an invalid response, the event is **escalated** to manual review. This fail-safe ensures that a broken agent or unreachable endpoint never silently blocks a Claude Code session.
