/**
 * MIAH HERMES - SOFTWARE CODER WORKER
 * Oddsify Labs - Hostinger VPS
 *
 * Polls HAMH (Railway) for coding/deployment tasks.
 */

const axios = require('axios');
require('dotenv').config();

const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'https://hamh.oddsifylabs.com';
const AGENT_ID = 'miah';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

const hamhApi = axios.create({
  baseURL: HAMH_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Miah-Hermes-Worker/1.0' }
});

function log(level, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
}

// ============================================
// TASK HANDLERS
// ============================================

const handlers = {

  async 'write-code'(task) {
    log('info', `Writing code: ${task.description}`);

    // TODO: Implement actual code generation
    // Options: call local LLM API, use Ollama, or use OpenRouter/Kimi

    const result = {
      action: 'write-code',
      description: task.description,
      status: 'simulated',
      message: 'Code writer stub. Wire in LLM or code generation tool.',
      generatedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'deploy'(task) {
    log('info', `Deploying: ${task.description}`);

    // TODO: Implement actual deployment
    // Options: ssh to target, run deploy scripts, use railway CLI, etc.

    const result = {
      action: 'deploy',
      description: task.description,
      status: 'simulated',
      message: 'Deploy stub. Wire in actual deployment pipeline.',
      deployedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'debug'(task) {
    log('info', `Debugging: ${task.description}`);

    const result = {
      action: 'debug',
      description: task.description,
      status: 'simulated',
      message: 'Debug stub. Wire in log analysis / error tracing.',
      debuggedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'code-review'(task) {
    log('info', `Reviewing code: ${task.description}`);

    const result = {
      action: 'code-review',
      description: task.description,
      status: 'simulated',
      message: 'Code review stub. Wire in PR fetch + LLM review.',
      reviewedAt: new Date().toISOString()
    };
    return { success: true, result };
  },

  async 'automation'(task) {
    log('info', `Running automation: ${task.description}`);

    const result = {
      action: 'automation',
      description: task.description,
      status: 'simulated',
      message: 'Automation stub. Wire in script runner or CI trigger.',
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
  log('info', '║  MIAH HERMES - SOFTWARE CODER WORKER     ║');
  log('info', '║  Oddsify Labs - Hostinger VPS            ║');
  log('info', `║  HAMH: ${HAMH_BASE_URL.padEnd(33)} ║`);
  log('info', `║  Poll interval: ${POLL_INTERVAL_MS}ms${' '.repeat(21 - String(POLL_INTERVAL_MS).length)} ║`);
  log('info', '╚══════════════════════════════════════════╝');

  pollForTask();
  setInterval(pollForTask, POLL_INTERVAL_MS);
}

process.on('SIGINT', () => { log('info', 'Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { log('info', 'Shutting down...'); process.exit(0); });

start();
