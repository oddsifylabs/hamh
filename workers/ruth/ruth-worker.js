/**
 * RUTH HERMES - WEB DEVELOPER WORKER
 * Oddsify Labs - Railway
 *
 * Polls HAMH for web dev, frontend, backend, UI/UX tasks.
 */

const axios = require('axios');
require('dotenv').config();

const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'https://hamh.oddsifylabs.com';
const AGENT_ID = 'ruth';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

const hamhApi = axios.create({
  baseURL: HAMH_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Ruth-Hermes-Worker/1.0' }
});

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// ============================================
// TASK HANDLERS
// ============================================

const handlers = {

  async 'web-development'(task) {
    log('info', `Web dev: ${task.description}`);

    // TODO: Implement actual web development
    // Options: generate code, scaffold projects, edit files, git operations

    const result = {
      action: 'web-development',
      description: task.description,
      status: 'simulated',
      message: 'Web dev stub. Wire in code generation or file editing.',
      generatedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'frontend'(task) {
    log('info', `Frontend: ${task.description}`);

    const result = {
      action: 'frontend',
      description: task.description,
      status: 'simulated',
      message: 'Frontend stub. Wire in HTML/CSS/JS generation or framework tools.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'backend'(task) {
    log('info', `Backend: ${task.description}`);

    const result = {
      action: 'backend',
      description: task.description,
      status: 'simulated',
      message: 'Backend stub. Wire in API/server/database code generation.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'ui-ux'(task) {
    log('info', `UI/UX: ${task.description}`);

    const result = {
      action: 'ui-ux',
      description: task.description,
      status: 'simulated',
      message: 'UI/UX stub. Wire in design system or component generation.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'deployment'(task) {
    log('info', `Deployment: ${task.description}`);

    const result = {
      action: 'deployment',
      description: task.description,
      status: 'simulated',
      message: 'Deployment stub. Wire in Railway/Hostinger deploy scripts.',
      executedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'maintenance'(task) {
    log('info', `Maintenance: ${task.description}`);

    const result = {
      action: 'maintenance',
      description: task.description,
      status: 'simulated',
      message: 'Maintenance stub. Wire in health checks, updates, cleanup.',
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
  log('info', '║  RUTH HERMES - WEB DEVELOPER WORKER      ║');
  log('info', '║  Oddsify Labs - Railway                  ║');
  log('info', `║  HAMH: ${HAMH_BASE_URL.padEnd(33)} ║`);
  log('info', `║  Poll interval: ${POLL_INTERVAL_MS}ms${' '.repeat(21 - String(POLL_INTERVAL_MS).length)} ║`);
  log('info', '╚══════════════════════════════════════════╝');

  pollForTask();
  setInterval(pollForTask, POLL_INTERVAL_MS);
}

process.on('SIGINT', () => { log('info', 'Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('info', 'Shutting down...'); process.exit(0); });

start();
