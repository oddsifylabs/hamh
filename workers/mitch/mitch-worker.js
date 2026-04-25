/**
 * MITCH HERMES - SALES & MARKETING WORKER
 * Oddsify Labs - Railway
 *
 * Polls HAMH for sales, marketing, and lead-gen tasks.
 */

const axios = require('axios');
require('dotenv').config();

const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'https://hamh.oddsifylabs.com';
const AGENT_ID = 'mitch';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

const hamhApi = axios.create({
  baseURL: HAMH_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mitch-Hermes-Worker/1.0' }
});

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// ============================================
// TASK HANDLERS
// ============================================

const handlers = {

  async 'lead-generation'(task) {
    log('info', `Lead gen: ${task.description}`);

    // TODO: Implement lead scraping, outreach, etc.
    const result = {
      action: 'lead-generation',
      description: task.description,
      status: 'simulated',
      message: 'Lead generation stub. Wire in scraping/outreach tools.',
      generatedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'sales'(task) {
    log('info', `Sales task: ${task.description}`);

    const result = {
      action: 'sales',
      description: task.description,
      status: 'simulated',
      message: 'Sales stub. Wire in CRM or outreach pipeline.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'marketing'(task) {
    log('info', `Marketing: ${task.description}`);

    const result = {
      action: 'marketing',
      description: task.description,
      status: 'simulated',
      message: 'Marketing stub. Wire in campaign tools.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'crm'(task) {
    log('info', `CRM task: ${task.description}`);

    const result = {
      action: 'crm',
      description: task.description,
      status: 'simulated',
      message: 'CRM stub. Wire in CRM API (HubSpot, Salesforce, etc).',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'custom'(task) {
    log('warn', `Unknown task type "${task.type}": ${task.description}`);
    return { success: false, result: { action: task.type, status: 'unhandled', message: `No handler for ${task.type}` } };
  }
};

// ============================================
// POLL LOOP
// ============================================

async function pollForTask() {
  try {
    const response = await hamhApi.get(`/api/tasks/poll?agent=${AGENT_ID}`);
    if (response.status === 204) return;

    const { task } = response.data;
    if (!task) return;

    log('info', `Received task: ${task.id} | ${task.type} | ${task.description}`);

    const handler = handlers[task.type] || handlers['custom'];
    let executionResult;
    try {
      executionResult = await handler(task);
    } catch (err) {
      log('error', `Handler crashed: ${err.message}`);
      executionResult = { success: false, result: { error: err.message } };
    }

    if (executionResult.success) {
      await hamhApi.post(`/api/tasks/${task.id}/complete`, { workerId: AGENT_ID, result: executionResult.result });
      log('info', `Reported completion for task ${task.id}`);
    } else {
      await hamhApi.post(`/api/tasks/${task.id}/fail`, { workerId: AGENT_ID, error: executionResult.result?.error || 'Unknown error' });
      log('info', `Reported failure for task ${task.id}`);
    }

  } catch (error) {
    if (error.response && error.response.status === 204) return;
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      log('error', `Cannot reach HAMH. Retrying...`);
    } else {
      log('error', `Poll error: ${error.message}`);
    }
  }
}

function start() {
  log('info', '╔══════════════════════════════════════════╗');
  log('info', '║  MITCH HERMES - SALES & MARKETING WORKER  ║');
  log('info', '║  Oddsify Labs - Railway                   ║');
  log('info', `║  HAMH: ${HAMH_BASE_URL.padEnd(33)} ║`);
  log('info', `║  Poll interval: ${POLL_INTERVAL_MS}ms${' '.repeat(21 - String(POLL_INTERVAL_MS).length)} ║`);
  log('info', '╚══════════════════════════════════════════╝');

  pollForTask();
  setInterval(pollForTask, POLL_INTERVAL_MS);
}

process.on('SIGINT', () => { log('info', 'Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('info', 'Shutting down...'); process.exit(0); });

start();
