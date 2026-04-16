# User Manual

This guide covers how to use Golden Apple Island after installation. For setup instructions, see the [Quick Start](../README.md#quick-start) in the README.

## How It Works

When Claude Code executes a tool call (running a shell command, writing a file, etc.), Golden Apple Island intercepts it before it happens:

1. Claude Code triggers a **hook** on each tool call.
2. The hook forwards the event through a lightweight **bridge** to Golden Apple Island's backend via WebSocket (`localhost:10423`).
3. The backend resolves your **Approval Policy** instantly:
   - **Auto** — approved silently; the event never reaches the UI.
   - **Manual** — queued in the Popup for you to approve or deny.
   - **Agent** — delegated to a local Claude Code agent for automated review.
   - **External** — delegated to an HTTP endpoint you control.
4. The decision flows back to Claude Code, which continues or aborts the tool call.

```text
Claude Code ─► Hook ─► Bridge ─► GAI Backend ─┬─► Auto (silent approve)
                                               ├─► Popup (human review)
                                               └─► Agent / External (delegate)
                                                        │
                                          Response ◄────┘
```

Everything is local — no data leaves your machine unless you configure an External Approve endpoint.

## The Popup Window

The popup is your primary interaction surface. Left-click the tray icon (or press `Ctrl+Shift+G`) to toggle it.

### Header

- **Connection indicator** — animated gold glow when connected to active Claude Code sessions; static when offline.
- **Pending badge** — shows the number of events waiting for your decision.
- **Buttons** — pin (keep on top), minimize to tray, open settings.

### Approval Cards

Each pending event appears as a card in a vertical stack:

- **Left vein bar** — color-coded by tool category:
  - Amber = shell command
  - Blue = file write
  - Slate = file read
  - Violet = question / follow-up
- **Card content** — tool name, the command or file path, working directory, and WSL distro.
- **Actions** — **Approve** (`A`) and **Deny** (`D`) via buttons or keyboard shortcuts.

Special card types:

- **Question Card** — when Claude asks a follow-up question. Has a text input field, **Submit** and **Skip** buttons.
- **Permission Card** — for permission requests. Three buttons: **Allow**, **Allow Session** (persists for this session), **Deny**.
- **Delegated Card** — an Agent or External endpoint is deciding. Shows a spinning indicator and a **Take over** link if you want to reclaim the decision.

### Policy Panel

At the bottom of the popup, two dropdown controls:

- **Override Policy** — ephemeral global override that trumps all other rules. Options: Force Auto, Force Manual, Agent, External. Resets when the app restarts (memory-only).
- **Session Policy** — sets a persistent rule for the currently active session. Options: Auto Approve, Manual, Agent, External.
- **Approve All** (`Shift+A`) — approves every currently pending card.

### Recent History

A collapsible section showing the last ~10 decisions. Each entry has a color-coded left bar:

- Gold = manually approved
- Red = denied
- Dark gold = auto-approved
- Violet = agent decided
- Blue = external decided

## Approval Policies

Approval policies determine how each incoming event is handled. They resolve along a four-tier precedence chain — the most specific matching rule wins.

### Precedence (high to low)

| Tier | Scope | Example |
|------|-------|---------|
| **Session** | A specific Claude Code session | "Auto-approve everything in this debugging session" |
| **Folder** | A working directory (with optional subdirectory inclusion) | "Auto-approve all work in `~/my-project`" |
| **Distribution** | A WSL distro | "Auto-approve everything from Ubuntu-24.04" |
| **Global** | Everything else | "Default to Manual for anything not covered above" |

Each tier supports four policy kinds: **Manual**, **Auto**, **Agent**, **External**.

### Configuration

Open **Settings → Approval Policy** to manage rules:

- **Global** — the fallback rule. Default is Manual.
- **Per Distribution** — add rules for specific WSL distros.
- **Per Folder** — add rules for specific working directories. Toggle **Include subdirectories** to cover nested paths.
- **Per Session** — set via the Popup's Policy Panel dropdown, or from the Recent Sessions list in Settings.

### How it behaves

- **Auto** events are resolved entirely in the backend — they never appear in the Popup.
- **Override Policy** (set in the Popup) has the highest priority, above all four tiers. It's memory-only and resets on app restart.
- **Agent / External** kinds delegate the decision to the respective system (see [Agent Approve & External Approve](#agent-approve--external-approve-experimental) below).

### Best practices

- **Start with Manual** (the default). Observe which tool calls you always approve, then promote those folders or distros to Auto.
- **Folder rules** are ideal for "I trust this project" — set the project root to Auto and work hands-free.
- **Session rules** are ideal for "I trust this particular run" — keeps the broader policy untouched.

## Hook Management

Hook Management controls which Claude Code events Golden Apple Island can see. Different **Working Modes** subscribe to different event types.

### Working Modes

| Mode | What it captures | Blocking? |
|------|-----------------|-----------|
| **Control** | `PermissionRequest` only | Yes |
| **Audit** | `PreToolUse` + `PermissionRequest` | Yes |
| **Observe** | All events (adds `PostToolUse`, `SessionStart/End`, `Notification`, etc.) | Blocking for PreToolUse / PermissionRequest; fire-and-forget for the rest |
| **Custom** | Your choice of event types | Depends on selected types |

**Blocking** means Claude Code waits for your decision before proceeding. **Fire-and-forget** means the event is recorded but doesn't pause Claude Code.

### Configuration

Open **Settings → Hook Management**:

- **Windows hook** — enable for native Windows Claude Code installations.
- **WSL Instances** — each distro gets its own mode selector. Use **Enable All** / **Disable All** / **Update Scripts** for bulk operations.
- **Custom mode** — when selected, expands a checkbox list of individual event types to subscribe to.

Hook scripts are installed and managed automatically — you don't need to touch any config files.

## Audit History

Audit History is a persistent log of every event that passed through Golden Apple Island, stored locally on your machine.

### Browsing

Open **Settings → Audit History**. Events are organized in a two-level hierarchy:

- **Folder** → **Session** → individual events.

Each entry shows: tool name, summary, timestamp, decision (approve / deny / escalate), and source (manual / auto / agent / external). Click an entry to expand full event details.

### Pin & cleanup

- **Pin** important entries to protect them from automatic cleanup.
- Unpinned entries are evicted by LRU (least recently used) policy. Large fields are truncated to 64 KB.
- Manual delete only affects unpinned entries — pinned ones are always preserved.

Audit logs are stored in `%APPDATA%\GoldenAppleIsland\audit\`.

### Best practices

- Pair **Observe** hook mode with Audit History to review everything Claude did in a session after the fact.
- **Pin** critical decisions — especially those involving production environments or destructive operations — for future reference.

## Agent Approve & External Approve (Experimental)

Both features automate approval decisions by delegating them to an external decision-maker. Both support **escalate** as a safety valve — if the delegate can't decide or encounters an error, the event falls through to manual review in the Popup. You're never locked out.

### Agent Approve

Delegates approval to a local Claude Code agent — essentially a second Claude that reviews what the first Claude wants to do.

- The agent receives each event and returns one of: **approve**, **reject**, or **escalate**.
- **Default workspace:** Uses [ALICE](https://github.com/CreeperLKF/ALICE), which evaluates operations across four dimensions — irreversibility, blast radius, information flow, and authorization scope.
- **Custom workspace:** Point to any directory containing your own `CLAUDE.md` that defines your approval logic.
- **Singleton session:** The agent maintains conversational context across multiple events within a session. It auto-resets after reaching the turn limit (default: 20).

**Configuration** (Settings → Approval Policy tab, bottom section):

- Workspace path — directory containing `CLAUDE.md` for the reviewing agent.
- Turn limit — number of turns before the agent session resets (default: 20).
- Call timeout — max seconds to wait for the agent's decision (default: 60).
- **Create default workspace** — downloads the ALICE profile.
- **Reset session** — forces a fresh agent session.

### External Approve

Delegates approval to an HTTP endpoint you control — useful for teams with existing approval systems or custom rule engines.

- Golden Apple Island POSTs the event as JSON to your endpoint.
- Your endpoint responds with: `{"verdict": "approve"|"reject"|"escalate", "reason": "..."}`.
- Supports a custom auth header for authentication.

**Configuration** (Settings → Approval Policy tab, bottom section):

- Endpoint URL — where to send the POST request.
- Auth header — free-form `Header-Name: value` for authentication.
- Call timeout — max seconds to wait for a response (default: 30).
- **Test endpoint** — sends a test request and shows inline feedback.

### Best practices

- **Start with ALICE** for Agent Approve. Understand its judgment logic before writing a custom workspace.
- **External Approve** shines when you already have an internal review system or want to plug in your own LLM / rule engine.
- Both always fall back to manual review on **escalate**, so there's zero risk of the app becoming unresponsive.

## Best Practices & Tips

### Progressive trust

Start conservative, loosen as you build confidence:

1. **Manual** (default) — review every tool call until you see the patterns.
2. **Auto** for trusted folders/distros — eliminate repetitive approvals.
3. **Agent / External** — for advanced automation once you're comfortable with the system.

### Multi-session workflows

- Running multiple Claude Code sessions in parallel? Use **Session Policy** to set independent rules for each.
- Need a quick burst of full trust? Set **Override Policy** to Force Auto — but remember it resets when the app restarts.

### Choosing a hook mode

- **Audit** — the everyday mode. Captures all tool calls for approval without noise from observational events.
- **Observe** — when you want a complete picture of what happened in a session (pair with Audit History for post-hoc review).
- **Control** — minimal interruption. Only explicit permission prompts come through.

### Keyboard shortcuts

All customizable in **Settings → General**:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+G` | Toggle popup visibility |
| `A` | Approve the top pending card |
| `D` | Deny the top pending card |
| `Shift+A` | Approve all pending cards |
| `Esc` | Hide the popup |
