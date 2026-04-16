#!/usr/bin/env node
import { randomUUID, createHash } from 'node:crypto';
import process from 'node:process';

const WS_PORT = 10423;
const WS_URL = `ws://localhost:${WS_PORT}`;
const BLOCKING_TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_HOOK_GUARD_TIMEOUT_MS ?? '', 10) || 300000;
const OBSERVATIONAL_DRAIN_MS = 50;

const BLOCKING_TYPES = new Set(['pre_tool_use', 'permission_request', 'user_prompt_submit']);

const hookTypeArg = process.argv.find(a => a.startsWith('--hook-type='));
const HOOK_TYPE = hookTypeArg ? hookTypeArg.split('=')[1] : 'pre_tool_use';
const IS_BLOCKING = BLOCKING_TYPES.has(HOOK_TYPE);

function emitBlockingDeny(reason) {
  if (reason) process.stderr.write(`[golden-apple-island] ${reason}\n`);
  const json = buildResponseJson('deny', null, null);
  process.stdout.write(json);
  process.exit(2);
}

function emitBlockingResponse(action, answer, sessionMode) {
  const json = buildResponseJson(action, answer, sessionMode);
  process.stdout.write(json);
  process.exit(0);
}

function buildResponseJson(action, answer, sessionMode) {
  if (HOOK_TYPE === 'permission_request') {
    return buildPermissionRequestJson(action, sessionMode);
  }
  if (HOOK_TYPE === 'user_prompt_submit') {
    return buildUserPromptSubmitJson(action);
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
  if (answer != null) output.updatedInput = { answer };
  return JSON.stringify({ hookSpecificOutput: output });
}

function buildPermissionRequestJson(action, sessionMode) {
  const decision = { behavior: action === 'approve' ? 'allow' : 'deny' };
  if (action !== 'approve') decision.message = 'Denied via Golden Apple Island';
  if (action === 'approve' && sessionMode) {
    decision.updatedPermissions = [
      { type: 'setMode', mode: sessionMode, destination: 'session' },
    ];
  }
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } });
}

function buildUserPromptSubmitJson(action) {
  // Claude Code's UserPromptSubmit hook blocks when it returns a deny decision.
  // Approve = empty output (lets the prompt through).
  if (action === 'approve') return '';
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      decision: { behavior: 'deny', message: 'Denied via Golden Apple Island' },
    },
  });
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function stableSessionId(cwd) {
  return 'sess_' + createHash('sha1').update(`${cwd}:${process.pid}`).digest('hex').slice(0, 12);
}

async function main() {
  if (typeof WebSocket === 'undefined') {
    if (IS_BLOCKING) {
      emitBlockingDeny('global WebSocket not available — requires Node 22+ (or Node 18+ with --experimental-websocket)');
    } else {
      process.exit(0);
    }
    return;
  }

  const raw = await readStdin();
  let payload = {};
  if (raw.trim().length > 0) {
    try { payload = JSON.parse(raw); } catch { payload = {}; }
  }

  const cwd = payload.cwd || payload.working_dir || process.cwd();
  const sessionId = payload.session_id || process.env.CLAUDE_SESSION_ID || stableSessionId(cwd);
  const toolName = payload.tool_name || payload.hook_event_name || HOOK_TYPE;
  const toolInput = payload.tool_input && typeof payload.tool_input === 'object'
    ? payload.tool_input
    : (typeof payload === 'object' ? payload : {});

  const id = 'evt_' + randomUUID().replaceAll('-', '').slice(0, 12);
  const distro = process.env.WSL_DISTRO_NAME || 'windows';

  const event = {
    type: 'hook_event',
    id,
    session_id: sessionId,
    session_cwd: cwd,
    source_distro: distro,
    hook_type: HOOK_TYPE,
    tool_name: toolName,
    tool_input: toolInput,
    timestamp: new Date().toISOString(),
  };

  if (IS_BLOCKING) {
    await runBlocking(event, id);
  } else {
    await runObservational(event);
    process.exit(0);
  }
}

async function runBlocking(event, id) {
  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    emitBlockingDeny(`failed to construct WebSocket: ${err?.message ?? err}`);
    return;
  }

  let settled = false;
  const finish = (action, answer, sessionMode, reason) => {
    if (settled) return;
    settled = true;
    try { ws.close(); } catch { /* ignore */ }
    clearTimeout(timer);
    if (action === 'approve' || action === 'deny') {
      emitBlockingResponse(action, answer, sessionMode);
    } else {
      emitBlockingDeny(reason);
    }
  };

  const timer = setTimeout(
    () => finish(null, null, null, `timeout after ${BLOCKING_TIMEOUT_MS}ms waiting for hook_response`),
    BLOCKING_TIMEOUT_MS,
  );

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
    } catch { return; }
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

async function runObservational(event) {
  // Fire-and-forget: open socket, send, wait briefly for drain, return.
  // Never block on response; never exit nonzero on failure — Claude Code
  // must not observe any latency or errors for observational events.
  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    return;
  }

  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve();
    };

    const drain = setTimeout(finish, OBSERVATIONAL_DRAIN_MS);

    ws.addEventListener('open', () => {
      try {
        ws.send(JSON.stringify(event));
      } catch { /* swallow */ }
      // Give the socket a tick to flush, then bail.
      setTimeout(() => {
        clearTimeout(drain);
        finish();
      }, 5);
    });
    ws.addEventListener('error', finish);
    ws.addEventListener('close', finish);
  });
}

main().catch(() => {
  if (IS_BLOCKING) {
    emitBlockingDeny('unexpected error');
  } else {
    process.exit(0);
  }
});
