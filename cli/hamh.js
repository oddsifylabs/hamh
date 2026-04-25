#!/usr/bin/env node

/**
 * HAMH CLI
 * Hermes Agent Management Hub - Command Line Interface
 * Oddsify Labs
 *
 * Usage:
 *   hamh status              Show fleet status
 *   hamh send "@markus ..."  Send a command to HAMH
 *   hamh inbox               Check director inbox
 *   hamh logs [--limit N]    Show activity log
 *   hamh workers             List all workers
 *   hamh config              Show current config
 *   hamh config --set url https://hamh.oddsifylabs.com
 *   hamh config --set key YOUR_API_KEY
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');

const CONFIG_DIR = path.join(os.homedir(), '.hamh');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function color(name, text) {
  return `${COLORS[name] || ''}${text}${COLORS.reset}`;
}

function ensureConfig() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfig();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch {
      return {};
    }
  }
  return {};
}

function saveConfig(cfg) {
  ensureConfig();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function getApiClient() {
  const cfg = loadConfig();
  const baseURL = cfg.url || process.env.HAMH_URL || 'http://localhost:3000';
  const apiKey = cfg.key || process.env.HAMH_API_KEY;

  if (!apiKey) {
    console.error(color('red', 'Error: No API key configured.'));
    console.error('Run: hamh config --set key YOUR_API_KEY');
    console.error('Or set HAMH_API_KEY environment variable.');
    process.exit(1);
  }

  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    timeout: 15000,
  });
}

// ============================================
// COMMANDS
// ============================================

async function cmdStatus() {
  const api = getApiClient();
  const { data } = await api.get('/status');

  console.log();
  console.log(color('bright', '╔════════════════════════════════════════╗'));
  console.log(color('bright', '║  HAMH FLEET STATUS                       ║'));
  console.log(color('bright', '╚════════════════════════════════════════╝'));
  console.log();

  const workers = Object.entries(data.workers);
  for (const [id, w] of workers) {
    const statusColor = w.status === 'active' ? 'green' : 'red';
    const queueColor = w.queueLength > 0 ? 'yellow' : 'dim';
    console.log(`  ${color(statusColor, '●')} ${color('bright', w.name)} ${color('dim', `(${id})`)}`);
    console.log(`     Type: ${w.type}  |  Queue: ${color(queueColor, String(w.queueLength))}`);
    if (w.currentTask) {
      console.log(`     Current: ${color('cyan', w.currentTask.description)}`);
    }
    console.log();
  }

  console.log(color('dim', `  Uptime: ${data.uptime || 'N/A'}`));
  console.log(color('dim', `  Timestamp: ${data.timestamp}`));
  console.log();
}

async function cmdSend(commandStr) {
  if (!commandStr) {
    console.error(color('red', 'Usage: hamh send "@markus post-x hello world"'));
    process.exit(1);
  }

  const api = getApiClient();
  const { data } = await api.post('/command', { command: commandStr, source: 'cli' });

  console.log();
  console.log(color('green', '✓ Command sent'));
  console.log(`  Command: ${color('bright', commandStr)}`);
  console.log(`  Status:  ${color('cyan', data.status)}`);
  if (data.task) {
    console.log(`  Task ID: ${color('dim', data.task.id)}`);
    console.log(`  Worker:  ${color('bright', data.task.workerId)}`);
  }
  if (data.flow) {
    console.log(`  Flow:    ${color('dim', data.flow)}`);
  }
  if (data.message) {
    console.log(`  Message: ${data.message}`);
  }
  console.log();
}

async function cmdInbox() {
  const api = getApiClient();
  const [{ data: inbox }, { data: reports }] = await Promise.all([
    api.get('/octavia/inbox'),
    api.get('/octavia/reports'),
  ]);

  console.log();
  console.log(color('bright', '┌───────────────────────── DIRECTOR INBOX ─────────────────────────┐'));
  console.log();

  if (!inbox.messages || inbox.messages.length === 0) {
    console.log(color('dim', '  No messages.'));
  } else {
    for (const msg of inbox.messages.slice(0, 10)) {
      const statusIcon = msg.status === 'unread' ? color('yellow', '●') : color('dim', '○');
      const ts = new Date(msg.timestamp).toLocaleTimeString();
      console.log(`  ${statusIcon} [${ts}] ${msg.message}`);
    }
  }

  console.log();
  console.log(color('bright', `┌───────────────────────── AGENT REPORTS ─────────────────────────┐`));
  console.log();

  if (!reports.reports || reports.reports.length === 0) {
    console.log(color('dim', '  No reports.'));
  } else {
    for (const r of reports.reports.slice(0, 10)) {
      const statusIcon = r.status === 'unread' ? color('yellow', '●') : color('dim', '○');
      const ts = new Date(r.timestamp).toLocaleTimeString();
      const from = color('bright', r.agentId);
      console.log(`  ${statusIcon} [${ts}] ${from}: ${r.summary || r.type}`);
    }
  }

  console.log();
}

async function cmdLogs(args) {
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) || 20 : 20;
  const api = getApiClient();
  const { data } = await api.get('/activity', { params: { limit } });

  console.log();
  console.log(color('bright', `┌───────────────────────── ACTIVITY LOG ─────────────────────────┐`));
  console.log();

  if (!data.log || data.log.length === 0) {
    console.log(color('dim', '  No activity.'));
  } else {
    for (const entry of data.log) {
      const ts = new Date(entry.timestamp).toLocaleTimeString();
      console.log(`  ${color('dim', ts)} ${entry.message}`);
    }
  }

  console.log();
}

async function cmdWorkers() {
  const api = getApiClient();
  const { data } = await api.get('/octavia/status');

  console.log();
  console.log(color('bright', '┌───────────────────────── WORKERS ─────────────────────────┐'));
  console.log();

  for (const [id, w] of Object.entries(data.workers)) {
    console.log(`  ${color('bright', w.name)} ${color('dim', `(${id})`)}`);
    console.log(`    Role:   ${w.role || 'worker'}`);
    console.log(`    Type:   ${w.type}`);
    console.log(`    Caps:   ${w.capabilities.join(', ')}`);
    console.log(`    Queue:  ${w.queueLength}`);
    console.log();
  }

  console.log(`  Flow mode: ${color('cyan', data.octavia.mode)}`);
  console.log(`  Pending approvals: ${data.octavia.pendingApprovals}`);
  console.log();
}

async function cmdConfig(args) {
  const cfg = loadConfig();

  if (args.includes('--set')) {
    const idx = args.indexOf('--set');
    const key = args[idx + 1];
    const value = args[idx + 2];

    if (!key || !value) {
      console.error(color('red', 'Usage: hamh config --set <key> <value>'));
      console.error('Keys: url, key');
      process.exit(1);
    }

    if (key === 'url') {
      cfg.url = value;
    } else if (key === 'key') {
      cfg.key = value;
    } else {
      console.error(color('red', `Unknown key: ${key}`));
      process.exit(1);
    }

    saveConfig(cfg);
    console.log(color('green', `✓ Set ${key} = ${value}`));
    return;
  }

  console.log();
  console.log(color('bright', 'HAMH Configuration'));
  console.log(`  Config file: ${CONFIG_FILE}`);
  console.log();
  console.log(`  URL: ${cfg.url || color('dim', '(not set)')}`);
  console.log(`  Key: ${cfg.key ? cfg.key.slice(0, 8) + '...' : color('dim', '(not set)')}`);
  console.log();
  console.log(color('dim', 'Environment overrides:'));
  console.log(`  HAMH_URL:     ${process.env.HAMH_URL || color('dim', '(not set)')}`);
  console.log(`  HAMH_API_KEY: ${process.env.HAMH_API_KEY ? process.env.HAMH_API_KEY.slice(0, 8) + '...' : color('dim', '(not set)')}`);
  console.log();
}

function showHelp() {
  console.log();
  console.log(color('bright', 'HAMH CLI - Hermes Agent Management Hub'));
  console.log(color('dim', 'Oddsify Labs'));
  console.log();
  console.log('Commands:');
  console.log(`  ${color('cyan', 'hamh status')}              Show fleet status`);
  console.log(`  ${color('cyan', 'hamh send "<cmd>"')}        Send a command (e.g., @markus post-x hi)`);
  console.log(`  ${color('cyan', 'hamh inbox')}               Check director inbox & agent reports`);
  console.log(`  ${color('cyan', 'hamh logs [--limit N]')}    Show activity log`);
  console.log(`  ${color('cyan', 'hamh workers')}             List all workers`);
  console.log(`  ${color('cyan', 'hamh config')}              Show config`);
  console.log(`  ${color('cyan', 'hamh config --set url <url>')}   Set HAMH URL`);
  console.log(`  ${color('cyan', 'hamh config --set key <key>')}   Set API key`);
  console.log();
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'status':
      case 's':
        await cmdStatus();
        break;
      case 'send':
        await cmdSend(args.slice(1).join(' '));
        break;
      case 'inbox':
      case 'i':
        await cmdInbox();
        break;
      case 'logs':
      case 'log':
        await cmdLogs(args);
        break;
      case 'workers':
      case 'w':
        await cmdWorkers();
        break;
      case 'config':
      case 'c':
        await cmdConfig(args);
        break;
      case 'help':
      case '-h':
      case '--help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    if (error.response) {
      console.error(color('red', `Error ${error.response.status}: ${error.response.data?.error || error.message}`));
    } else {
      console.error(color('red', `Error: ${error.message}`));
    }
    process.exit(1);
  }
}

main();
