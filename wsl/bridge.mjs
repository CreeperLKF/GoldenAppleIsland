#!/usr/bin/env node
import { randomUUID, createHash } from 'node:crypto';
import process from 'node:process';

const WS_PORT = 19876;
const WS_URL = `ws://localhost:${WS_PORT}`;
const TIMEOUT_MS = Number.parseInt(process.env.CLAUDE_HOOK_GUARD_TIMEOUT_MS ?? '', 10) || 300000;

function emitDeny(reason) {
  if (reason) process.stderr.write(`[golden-apple-island] ${reason}\n`);
  process.stdout.write('deny');
  process.exit(0);
}

function emitApproveDeny(action) {
  process.stdout.write(action === 'approve' ? 'approve' : 'deny');
  process.exit(0);
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
    hook_type: 'pre_tool_use',
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
  const finish = (action, reason) => {
    if (settled) return;
    settled = true;
    try { ws.close(); } catch { /* ignore */ }
    clearTimeout(timer);
    if (action === 'approve' || action === 'deny') {
      emitApproveDeny(action);
    } else {
      emitDeny(reason);
    }
  };

  const timer = setTimeout(() => finish('deny', `timeout after ${TIMEOUT_MS}ms waiting for hook_response`), TIMEOUT_MS);

  ws.addEventListener('open', () => {
    try {
      ws.send(JSON.stringify(event));
    } catch (err) {
      finish('deny', `send failed: ${err?.message ?? err}`);
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
      finish(data.action === 'approve' ? 'approve' : 'deny');
    }
  });

  ws.addEventListener('error', (ev) => {
    finish('deny', `websocket error: ${ev?.message ?? 'connection failed'}`);
  });

  ws.addEventListener('close', () => {
    if (!settled) finish('deny', 'websocket closed before response');
  });
}

main().catch((err) => {
  emitDeny(`unexpected error: ${err?.message ?? err}`);
});
