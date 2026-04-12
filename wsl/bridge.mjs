#!/usr/bin/env node
import { randomUUID, createHash } from 'node:crypto';
import process from 'node:process';

const WS_PORT = 19876;
const WS_URL = `ws://localhost:${WS_PORT}`;
const TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_HOOK_GUARD_TIMEOUT_MS ?? '', 10) || 300000;

// Parse --hook-type arg (default: pre_tool_use)
const hookTypeArg = process.argv.find(a => a.startsWith('--hook-type='));
const HOOK_TYPE = hookTypeArg ? hookTypeArg.split('=')[1] : 'pre_tool_use';

function emitDeny(reason) {
  if (reason) process.stderr.write(`[golden-apple-island] ${reason}\n`);
  const json = buildResponseJson('deny', null, null);
  process.stdout.write(json);
  process.exit(2);
}

function emitResponse(action, answer, sessionMode) {
  const json = buildResponseJson(action, answer, sessionMode);
  process.stdout.write(json);
  process.exit(0);
}

function buildResponseJson(action, answer, sessionMode) {
  if (HOOK_TYPE === 'permission_request') {
    return buildPermissionRequestJson(action, sessionMode);
  }
  return buildPreToolUseJson(action, answer);
}

function buildPreToolUseJson(action, answer) {
  const output = {
    hookEventName: 'PreToolUse',
    permissionDecision: action === 'approve' ? 'allow' : 'deny',
    permissionDecisionReason: action === 'approve'
      ? 'Approved via Golden Apple Island'
      : 'Denied via Golden Apple Island',
  };
  if (answer != null) {
    output.updatedInput = { answer };
  }
  return JSON.stringify({ hookSpecificOutput: output });
}

function buildPermissionRequestJson(action, sessionMode) {
  const decision = { behavior: action === 'approve' ? 'allow' : 'deny' };
  if (action !== 'approve') {
    decision.message = 'Denied via Golden Apple Island';
  }
  if (action === 'approve' && sessionMode) {
    decision.updatedPermissions = [
      { type: 'setMode', mode: sessionMode, destination: 'session' },
    ];
  }
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } });
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function stableSessionId(cwd) {
  return 'sess_' + createHash('sha1').update(`${cwd}:${process.pid}`).digest('hex').slice(0, 12);
}

async function main() {
  if (typeof WebSocket === 'undefined') {
    emitDeny('global WebSocket not available — requires Node 22+ (or Node 18+ with --experimental-websocket)');
    return;
  }

  const raw = await readStdin();
  let payload = {};
  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = {};
    }
  }

  const cwd = payload.cwd || payload.working_dir || process.cwd();
  const sessionId = payload.session_id || process.env.CLAUDE_SESSION_ID || stableSessionId(cwd);
  const toolName = payload.tool_name || 'unknown';
  const toolInput = payload.tool_input && typeof payload.tool_input === 'object' ? payload.tool_input : {};

  const id = 'evt_' + randomUUID().replaceAll('-', '').slice(0, 12);

  const event = {
    type: 'hook_event',
    id,
    session_id: sessionId,
    session_cwd: cwd,
    hook_type: HOOK_TYPE,
    tool_name: toolName,
    tool_input: toolInput,
    timestamp: new Date().toISOString(),
  };

  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    emitDeny(`failed to construct WebSocket: ${err?.message ?? err}`);
    return;
  }

  let settled = false;
  const finish = (action, answer, sessionMode, reason) => {
    if (settled) return;
    settled = true;
    try { ws.close(); } catch { /* ignore */ }
    clearTimeout(timer);
    if (action === 'approve' || action === 'deny') {
      emitResponse(action, answer, sessionMode);
    } else {
      emitDeny(reason);
    }
  };

  const timer = setTimeout(() => finish(null, null, null, `timeout after ${TIMEOUT_MS}ms waiting for hook_response`), TIMEOUT_MS);

  ws.addEventListener('open', () => {
    try {
      ws.send(JSON.stringify(event));
    } catch (err) {
      finish(null, null, null, `send failed: ${err?.message ?? err}`);
    }
  });

  ws.addEventListener('message', (ev) => {
    let data;
    try {
      const text = typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8');
      data = JSON.parse(text);
    } catch {
      return;
    }
    if (data && data.type === 'hook_response' && data.id === id) {
      const action = data.action === 'approve' ? 'approve' : 'deny';
      finish(action, data.answer ?? null, data.session_mode ?? null);
    }
  });

  ws.addEventListener('error', (ev) => {
    finish(null, null, null, `websocket error: ${ev?.message ?? 'connection failed'}`);
  });

  ws.addEventListener('close', () => {
    if (!settled) finish(null, null, null, 'websocket closed before response');
  });
}

main().catch((err) => {
  emitDeny(`unexpected error: ${err?.message ?? err}`);
});
