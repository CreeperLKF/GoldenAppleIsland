# WebSocket Protocol

The Tauri app listens on `127.0.0.1:19876`. All messages are JSON, one per frame. Responses are routed by event `id`, so multiple bridge clients can share the server safely.

## Bridge → app

```json
{
  "type": "hook_event",
  "id": "evt_abc123",
  "session_id": "sess_def456",
  "session_cwd": "/home/user/projects/my-app",
  "start_cwd_normalized": "/home/user/projects/my-app",
  "distro": "Ubuntu",
  "source_distro": "Ubuntu",
  "hook_type": "pre_tool_use",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf ./dist" },
  "timestamp": "2026-04-11T10:30:00Z"
}
```

Fields:

| Field | Meaning |
|---|---|
| `id` | Unique per event; used to route the response back. |
| `session_id` | Claude Code session identifier. Persists across tool calls in the same run. |
| `session_cwd` | The current working directory at the time of the tool call. |
| `start_cwd_normalized` | The directory the session started in, normalized for folder-rule matching. |
| `distro` | The WSL distribution name (e.g. `Ubuntu`, `Debian`). |
| `source_distro` | `unknown` if the hook script predates per-distribution tagging. Triggers the "update your scripts" advisory in settings. |
| `hook_type` | Currently only `pre_tool_use`. |
| `tool_name` | The Claude Code tool — `Bash`, `Read`, `Write`, `Edit`, `Glob`, etc. |
| `tool_input` | Opaque JSON forwarded from Claude Code. |
| `timestamp` | ISO-8601 UTC. |

## App → bridge

```json
{
  "type": "hook_response",
  "id": "evt_abc123",
  "action": "approve"
}
```

`action` is `"approve"` or `"deny"`. For `question`-style events (e.g. user-input prompts), an `answer` field carries the response string:

```json
{
  "type": "hook_response",
  "id": "evt_abc123",
  "action": "approve",
  "answer": "yes"
}
```

For permission-scope approvals, the optional `sessionMode` field carries a mode string like `"acceptEdits"` that Claude Code interprets as an elevated approval.

## App → bridge, auto-resolved events

When a backend approval policy auto-approves or auto-denies an event, the app still emits the normal `hook_response`. The event also fires on the `hook_event_auto_resolved` Tauri channel (internal) so the frontend can log it in the Recent history with the `auto` badge.

## Routing rules

- Each bridge client holds one open connection for the lifetime of the `claude` invocation.
- The server maintains a per-connection map of outstanding event `id`s and delivers each `hook_response` to the originating client.
- If the server goes away mid-event, the bridge's 5-minute timer expires and it prints `deny`, unblocking the `claude` process.
