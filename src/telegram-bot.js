/**
 * OCTAVIA TELEGRAM BOT INTERFACE
 * Oddsify Labs - Director Command Bridge
 *
 * Polls Telegram for messages from Jesse (Director).
 * Parses @mentions and forwards them to HAMH /command API.
 * Replies with confirmation/status.
 */

const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DIRECTOR_CHAT_ID = process.env.JESSE_CHAT_ID;
const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = parseInt(process.env.TELEGRAM_POLL_INTERVAL_MS) || 3000;

let isRunning = false;
let lastUpdateId = 0;

// ============================================
// LOGGING
// ============================================

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [TELEGRAM-${level.toUpperCase()}] ${message}`);
}

// ============================================
// TELEGRAM API HELPERS
// ============================================

const tgApi = axios.create({
  baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`,
  timeout: 15000
});

async function sendMessage(chatId, text, options = {}) {
  try {
    await tgApi.post('/sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    });
  } catch (error) {
    log('error', `Failed to send message: ${error.message}`);
  }
}

async function getUpdates() {
  try {
    const response = await tgApi.get('/getUpdates', {
      params: {
        offset: lastUpdateId + 1,
        limit: 10
      }
    });

    if (!response.data.ok) {
      log('error', `Telegram API error: ${response.data.description}`);
      return [];
    }

    return response.data.result || [];
  } catch (error) {
    log('error', `getUpdates failed: ${error.message}`);
    return [];
  }
}

// ============================================
// MESSAGE PARSER
// ============================================

function parseDirectorMessage(text) {
  const trimmed = text.trim();

  // Status report
  if (/^status\s*report$/i.test(trimmed)) {
    return { type: 'status-report', command: 'status report' };
  }

  // Pause / Resume
  if (/^pause\s+all$/i.test(trimmed)) {
    return { type: 'pause-all', command: 'pause all' };
  }
  if (/^resume\s+all$/i.test(trimmed)) {
    return { type: 'resume-all', command: 'resume all' };
  }

  // @mention to agent
  const mentionMatch = trimmed.match(/^@(miah|markus|mitch|ruth|octavia)\s+(.+)$/i);
  if (mentionMatch) {
    return {
      type: 'worker-task',
      command: trimmed
    };
  }

  // Manager directive (implicit octavia)
  if (/^(octavia|manager)\s*[:\-]?\s*/i.test(trimmed)) {
    const clean = trimmed.replace(/^(octavia|manager)\s*[:\-]?\s*/i, '');
    return {
      type: 'manager-directive',
      command: `@octavia ${clean}`
    };
  }

  // Fallback - treat as manager directive
  return {
    type: 'manager-directive',
    command: `@octavia ${trimmed}`
  };
}

// ============================================
// HAMH API CALLS
// ============================================

async function sendToHamh(command) {
  try {
    const response = await axios.post(`${HAMH_BASE_URL}/command`, {
      command,
      source: 'director'
    }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    });

    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      return { success: false, error: error.response.data?.error || `HTTP ${error.response.status}` };
    }
    return { success: false, error: error.message };
  }
}

async function getHamhStatus() {
  try {
    const response = await axios.get(`${HAMH_BASE_URL}/status`, { timeout: 10000 });
    return response.data;
  } catch (error) {
    return null;
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

async function handleDirectorMessage(message) {
  const text = message.text;
  const chatId = message.chat.id;

  log('info', `Director message: "${text}"`);

  const parsed = parseDirectorMessage(text);

  // Status report shortcut
  if (parsed.type === 'status-report') {
    const status = await getHamhStatus();
    if (!status) {
      await sendMessage(chatId, '❌ Could not reach HAMH. Is the server running?');
      return;
    }

    const workers = Object.entries(status.workers)
      .map(([id, w]) => `• *${w.name}*: ${w.queueLength} queued`)
      .join('\n');

    const recent = status.activityLog
      .slice(0, 5)
      .map(a => `• ${a.message}`)
      .join('\n');

    const reply = `📊 *HAMH Status*\n\n${workers}\n\n*Recent Activity:*\n${recent}`;
    await sendMessage(chatId, reply);
    return;
  }

  // Forward to HAMH
  const result = await sendToHamh(parsed.command);

  if (!result.success) {
    await sendMessage(chatId, `❌ *Error*\n\n${result.error}`);
    return;
  }

  const data = result.data;

  // Format response based on flow
  let reply = '';

  if (data.status === 'queued') {
    reply = `📋 *Task Queued*\n\n*Agent:* ${data.task.workerId}\n*Task:* ${data.task.description}\n*ID:* \`${data.task.id}\``;
  } else if (data.status === 'success') {
    reply = `✅ *Task Completed*\n\n*Agent:* ${data.task?.workerId || 'N/A'}\n*Task:* ${data.task?.description || parsed.command}`;
    if (data.result) {
      const resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result).slice(0, 300);
      reply += `\n*Result:* \`${resultStr}\``;
    }
  } else if (data.flow && data.flow.includes('octavia')) {
    reply = `🤖 *Octavia (Manager)*\n\n*Command:* ${parsed.command}\n*Status:* ${data.status || 'acknowledged'}`;
    if (data.message) reply += `\n*Note:* ${data.message}`;
  } else {
    reply = `✅ *Acknowledged*\n\n*Command:* ${parsed.command}\n*Response:* ${data.status || 'OK'}`;
  }

  await sendMessage(chatId, reply);
}

// ============================================
// MAIN POLL LOOP
// ============================================

async function processUpdates() {
  if (!BOT_TOKEN || !DIRECTOR_CHAT_ID) {
    log('warn', 'TELEGRAM_BOT_TOKEN or JESSE_CHAT_ID not set. Bot disabled.');
    return;
  }

  const updates = await getUpdates();

  for (const update of updates) {
    lastUpdateId = update.update_id;

    const message = update.message;
    if (!message || !message.text) continue;

    // Only respond to Director
    if (String(message.chat.id) !== String(DIRECTOR_CHAT_ID)) {
      log('warn', `Ignoring message from unauthorized chat: ${message.chat.id}`);
      continue;
    }

    await handleDirectorMessage(message);
  }
}

function start() {
  if (isRunning) return;
  if (!BOT_TOKEN || !DIRECTOR_CHAT_ID) {
    log('warn', 'Telegram bot not configured. Set TELEGRAM_BOT_TOKEN and JESSE_CHAT_ID env vars.');
    return;
  }

  isRunning = true;

  log('info', '╔══════════════════════════════════════════╗');
  log('info', '║  OCTAVIA TELEGRAM BOT INTERFACE          ║');
  log('info', '║  Director: Jesse Collins                 ║');
  log('info', `║  HAMH: ${HAMH_BASE_URL.padEnd(33)} ║`);
  log('info', '╚══════════════════════════════════════════╝');

  // Send startup notification
  sendMessage(DIRECTOR_CHAT_ID, '🤖 *Octavia is online.*\n\nSend me commands like:\n`@markus post hello world`\n`@miah deploy site`\n`status report`\n`pause all`');

  // Start polling
  processUpdates();
  setInterval(processUpdates, POLL_INTERVAL_MS);
}

function stop() {
  isRunning = false;
  log('info', 'Telegram bot stopped');
}

module.exports = { start, stop };
