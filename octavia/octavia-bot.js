/**
 * OCTAVIA HERMES - MANAGER AGENT TELEGRAM INTERFACE
 * Oddsify Labs - Director Command Bridge
 *
 * Polls Telegram for messages from Jesse.
 * Detects @mentions and forwards them to HAMH.
 * Handles general chat and status queries.
 */

const axios = require('axios');
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIRECTOR_CHAT_ID = process.env.JESSE_CHAT_ID;
const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'http://hamh.railway.internal:3000';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 3000;

let lastUpdateId = 0;

// ============================================
// LOGGING
// ============================================

function log(level, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [OCTAVIA-${level.toUpperCase()}] ${message}`);
}

// ============================================
// TELEGRAM API
// ============================================

const tg = axios.create({ baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`, timeout: 15000 });

async function sendMessage(chatId, text, options = {}) {
  try {
    await tg.post('/sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true, ...options });
  } catch (err) {
    log('error', `SendMessage failed: ${err.message}`);
  }
}

async function getUpdates() {
  try {
    const res = await tg.get('/getUpdates', { params: { offset: lastUpdateId + 1, limit: 10 } });
    if (!res.data.ok) { log('error', `Telegram error: ${res.data.description}`); return []; }
    return res.data.result || [];
  } catch (err) {
    log('error', `getUpdates failed: ${err.message}`);
    return [];
  }
}

// ============================================
// HAMH API
// ============================================

const hamh = axios.create({ baseURL: HAMH_BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });

async function hamhCommand(command) {
  try {
    const res = await hamh.post('/command', { command, source: 'director' });
    return { success: true, data: res.data };
  } catch (err) {
    if (err.response) return { success: false, error: err.response.data?.error || `HTTP ${err.response.status}` };
    return { success: false, error: err.message };
  }
}

async function hamhStatus() {
  try {
    const res = await hamh.get('/status', { timeout: 10000 });
    return res.data;
  } catch (err) {
    return null;
  }
}

// ============================================
// MESSAGE PARSER
// ============================================

function classifyMessage(text) {
  const t = text.trim();

  // Status report
  if (/^status\s*report$/i.test(t)) return { type: 'status-report' };

  // Pause / Resume
  if (/^pause\s+all$/i.test(t)) return { type: 'pause-all', command: 'pause all' };
  if (/^resume\s+all$/i.test(t)) return { type: 'resume-all', command: 'resume all' };

  // @mention to worker
  const mention = t.match(/^@(miah|markus|mitch|ruth|octavia)\s+(.+)$/i);
  if (mention) return { type: 'worker-task', command: t };

  // Implicit octavia directive
  return { type: 'manager-directive', command: `@octavia ${t}` };
}

// ============================================
// HANDLERS
// ============================================

async function handleStatusReport(chatId) {
  const status = await hamhStatus();
  if (!status) {
    await sendMessage(chatId, '\u274c Could not reach HAMH. Is the server running?');
    return;
  }

  const workers = Object.entries(status.workers)
    .map(([id, w]) => `\u2022 *${w.name}*: ${w.queueLength} queued`)
    .join('\n');

  const recent = status.activityLog.slice(0, 5).map(a => `\u2022 ${a.message}`).join('\n');

  await sendMessage(chatId, `\ud83d\udcca *HAMH Status*\n\n${workers}\n\n*Recent Activity:*\n${recent}`);
}

async function handleWorkerTask(chatId, text) {
  log('info', `Forwarding worker task: "${text}"`);

  const result = await hamhCommand(text);

  if (!result.success) {
    await sendMessage(chatId, `\u274c *HAMH Error*\n\n${result.error}`);
    return;
  }

  const data = result.data;
  let reply = '';

  if (data.status === 'queued') {
    reply = `\ud83d\udccb *Task Queued*\n\n*Agent:* ${data.task.workerId}\n*Task:* ${data.task.description}\n*ID:* \`${data.task.id}\``;
  } else if (data.status === 'success') {
    reply = `\u2705 *Task Completed*\n\n*Agent:* ${data.task?.workerId || 'N/A'}\n*Task:* ${data.task?.description || text}`;
    if (data.result) {
      const r = typeof data.result === 'string' ? data.result : JSON.stringify(data.result).slice(0, 300);
      reply += `\n*Result:* \`${r}\``;
    }
  } else if (data.flow?.includes('octavia')) {
    reply = `\ud83e\udd16 *Octavia Acknowledged*\n\n*Command:* ${text}\n*Status:* ${data.status || 'OK'}`;
    if (data.message) reply += `\n*Note:* ${data.message}`;
  } else {
    reply = `\u2705 *Acknowledged*\n\n*Command:* ${text}\n*Response:* ${data.status || 'OK'}`;
  }

  await sendMessage(chatId, reply);
}

async function handleManagerDirective(chatId, text, command) {
  log('info', `Forwarding manager directive: "${command}"`);

  const result = await hamhCommand(command);

  if (!result.success) {
    await sendMessage(chatId, `\u274c *HAMH Error*\n\n${result.error}`);
    return;
  }

  const data = result.data;

  if (data.status === 'queued') {
    await sendMessage(chatId, `\ud83d\udccb *Manager Task Queued*\n\n*Task:* ${data.task.description}\n*ID:* \`${data.task.id}\``);
  } else if (data.flow?.includes('octavia')) {
    await sendMessage(chatId, `\ud83e\udd16 *Octavia (Manager)*\n\n*Command:* ${text}\n*Status:* ${data.status || 'acknowledged'}\n*Flow:* ${data.flow}`);
  } else {
    await sendMessage(chatId, `\u2705 *Acknowledged*\n\n*Command:* ${text}\n*Response:* ${JSON.stringify(data).slice(0, 400)}`);
  }
}

// ============================================
// MAIN LOOP
// ============================================

async function processUpdates() {
  const updates = await getUpdates();

  for (const update of updates) {
    lastUpdateId = update.update_id;
    const msg = update.message;
    if (!msg || !msg.text) continue;

    // Security: only respond to Director
    if (String(msg.chat.id) !== String(DIRECTOR_CHAT_ID)) {
      log('warn', `Ignoring unauthorized chat: ${msg.chat.id}`);
      continue;
    }

    const text = msg.text;
    log('info', `Director: "${text}"`);

    const parsed = classifyMessage(text);

    switch (parsed.type) {
      case 'status-report':
        await handleStatusReport(msg.chat.id);
        break;
      case 'pause-all':
      case 'resume-all':
        await handleWorkerTask(msg.chat.id, parsed.command);
        break;
      case 'worker-task':
        await handleWorkerTask(msg.chat.id, text);
        break;
      case 'manager-directive':
        await handleManagerDirective(msg.chat.id, text, parsed.command);
        break;
    }
  }
}

// ============================================
// STARTUP
// ============================================

async function start() {
  if (!BOT_TOKEN || !DIRECTOR_CHAT_ID) {
    log('error', 'Missing TELEGRAM_BOT_TOKEN or JESSE_CHAT_ID');
    process.exit(1);
  }

  log('info', '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  log('info', '\u2551  OCTAVIA HERMES - MANAGER AGENT             \u2551');
  log('info', '\u2551  Oddsify Labs                              \u2551');
  log('info', `\u2551  HAMH: ${HAMH_BASE_URL.padEnd(33)} \u2551`);
  log('info', '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');

  // Send startup message
  await sendMessage(DIRECTOR_CHAT_ID,
    '\ud83e\udd16 *Octavia Hermes is online.*\n\n' +
    'Send me commands like:\n' +
    '`@markus post-x hello world`\n' +
    '`@miah deploy oddsifylabs.com`\n' +
    '`@mitch lead-gen Arizona`\n' +
    '`@ruth build landing page`\n' +
    '`status report`\n' +
    '`pause all` / `resume all`'
  );

  processUpdates();
  setInterval(processUpdates, POLL_INTERVAL_MS);
}

process.on('SIGINT', () => { log('info', 'Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('info', 'Shutting down...'); process.exit(0); });

start();
