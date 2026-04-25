/**
 * MARKUS HERMES - WORKER CLIENT
 * Oddsify Labs - Social Media Manager
 *
 * Runs on Markus's Mint Linux box.
 * Polls HAMH (Railway) for tasks, executes them, reports back.
 */

const axios = require('axios');
require('dotenv').config();

// ============================================
// CONFIGURATION
// ============================================

const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'https://hamh.oddsifylabs.com';
const AGENT_ID = 'markus';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

const hamhApi = axios.create({
  baseURL: HAMH_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Markus-Hermes-Worker/1.0'
  }
});

// ============================================
// LOGGING
// ============================================

function log(level, message) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

// ============================================
// TASK HANDLERS
// ============================================

const handlers = {

  /**
   * Post to X (Twitter)
   */
  async 'post-x'(task) {
    log('info', `Executing post-x: ${task.description}`);

    // TODO: Implement actual X posting
    // Options:
    //   - Use xurl CLI (if available on Markus's box)
    //   - Use Twitter API v2 directly
    //   - Use puppeteer/playwright for browser automation

    // For now, return a simulated result
    const result = {
      action: 'post-x',
      description: task.description,
      status: 'simulated',
      message: 'X post handler ready. Implement actual posting logic here.',
      postedAt: new Date().toISOString()
    };

    return { success: true, result };
  },

  /**
   * Engagement (reply, like, retweet, follow)
   */
  async 'engagement'(task) {
    log('info', `Executing engagement: ${task.description}`);

    const result = {
      action: 'engagement',
      description: task.description,
      status: 'simulated',
      message: 'Engagement handler ready. Implement reply/like/retweet logic here.',
      executedAt: new Date().toISOString()
    };

    return { success: true, result };
  },

  /**
   * Analytics (fetch stats, generate report)
   */
  async 'analytics'(task) {
    log('info', `Executing analytics: ${task.description}`);

    const result = {
      action: 'analytics',
      description: task.description,
      status: 'simulated',
      message: 'Analytics handler ready. Implement stats fetching logic here.',
      generatedAt: new Date().toISOString()
    };

    return { success: true, result };
  },

  /**
   * Curate content (find trending topics, gather links)
   */
  async 'curate-content'(task) {
    log('info', `Executing curate-content: ${task.description}`);

    const result = {
      action: 'curate-content',
      description: task.description,
      status: 'simulated',
      message: 'Content curation handler ready. Implement scraping/trending logic here.',
      curatedAt: new Date().toISOString()
    };

    return { success: true, result };
  },

  /**
   * Schedule posts
   */
  async 'schedule'(task) {
    log('info', `Executing schedule: ${task.description}`);

    const result = {
      action: 'schedule',
      description: task.description,
      status: 'simulated',
      message: 'Schedule handler ready. Implement cron/queue logic here.',
      scheduledAt: new Date().toISOString()
    };

    return { success: true, result };
  },

  /**
   * Fallback for unknown task types
   */
  async 'custom'(task) {
    log('warn', `Unknown task type "${task.type}": ${task.description}`);

    const result = {
      action: task.type || 'custom',
      description: task.description,
      status: 'unhandled',
      message: `No handler implemented for task type: ${task.type}`
    };

    return { success: false, result };
  }
};

// ============================================
// POLL & EXECUTE LOOP
// ============================================

async function pollForTask() {
  try {
    const response = await hamhApi.get(`/api/tasks/poll?agent=${AGENT_ID}`);

    if (response.status === 204) {
      log('debug', 'No tasks available');
      return;
    }

    const { task } = response.data;
    if (!task) {
      log('debug', 'No task in response');
      return;
    }

    log('info', `Received task: ${task.id} | ${task.type} | ${task.description}`);

    // Find handler
    const handler = handlers[task.type] || handlers['custom'];

    let executionResult;
    try {
      executionResult = await handler(task);
    } catch (handlerError) {
      log('error', `Handler crashed for task ${task.id}: ${handlerError.message}`);
      executionResult = {
        success: false,
        result: {
          error: handlerError.message,
          stack: handlerError.stack
        }
      };
    }

    // Report result back to HAMH
    if (executionResult.success) {
      await reportComplete(task.id, executionResult.result);
    } else {
      await reportFail(task.id, executionResult.result?.error || 'Unknown error');
    }

  } catch (error) {
    if (error.response) {
      if (error.response.status === 204) {
        // No tasks — this is normal
        return;
      }
      log('error', `HAMH error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      log('error', `Cannot reach HAMH at ${HAMH_BASE_URL}. Retrying...`);
    } else {
      log('error', `Poll error: ${error.message}`);
    }
  }
}

async function reportComplete(taskId, result) {
  try {
    await hamhApi.post(`/api/tasks/${taskId}/complete`, {
      workerId: AGENT_ID,
      result
    });
    log('info', `Reported completion for task ${taskId}`);
  } catch (error) {
    log('error', `Failed to report completion for ${taskId}: ${error.message}`);
  }
}

async function reportFail(taskId, error) {
  try {
    await hamhApi.post(`/api/tasks/${taskId}/fail`, {
      workerId: AGENT_ID,
      error: typeof error === 'string' ? error : JSON.stringify(error)
    });
    log('info', `Reported failure for task ${taskId}`);
  } catch (err) {
    log('error', `Failed to report failure for ${taskId}: ${err.message}`);
  }
}

// ============================================
// MAIN LOOP
// ============================================

function start() {
  log('info', '╔══════════════════════════════════════════╗');
  log('info', '║  MARKUS HERMES - SOCIAL MEDIA WORKER     ║');
  log('info', '║  Oddsify Labs - Mint Linux               ║');
  log('info', `║  HAMH: ${HAMH_BASE_URL.padEnd(33)} ║`);
  log('info', `║  Poll interval: ${POLL_INTERVAL_MS}ms${' '.repeat(21 - String(POLL_INTERVAL_MS).length)} ║`);
  log('info', '╚══════════════════════════════════════════╝');

  // Immediate first poll
  pollForTask();

  // Then every N seconds
  setInterval(pollForTask, POLL_INTERVAL_MS);
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGINT', () => {
  log('info', 'Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Shutting down gracefully...');
  process.exit(0);
});

// ============================================
// START
// ============================================

start();
