#!/usr/bin/env node

/**
 * OCTAVIA DAEMON — LLM-ENHANCED
 * Hermes Agent Management Hub - Autonomous Manager Agent
 * Oddsify Labs
 *
 * Responsibilities:
 * - Poll HAMH for tasks assigned to Octavia (manager queue)
 * - Auto-delegate, approve, and report based on Director commands
 * - Run scheduled health checks and reports
 * - Handle nightly debrief process
 * - Escalate blockers to Director inbox
 *
 * LLM Integration (optional):
 * - Rich status reports with insights and recommendations
 * - Smart task analysis for delegation decisions
 * - Professional director communications
 *
 * No Telegram. No external messaging. Pure API.
 */

const axios = require('axios');

// ============================================
// CONFIGURATION
// ============================================
const HAMH_BASE_URL = process.env.HAMH_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || process.env.HAMH_API_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 5000;
const HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS, 10) || 60000;
const AUTO_REPORT_INTERVAL_MS = parseInt(process.env.AUTO_REPORT_INTERVAL_MS, 10) || 3600000;

// Optional LLM for enhanced reports
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const LLM_TIMEOUT = parseInt(process.env.LLM_TIMEOUT_MS, 10) || 30000;

if (!API_KEY) {
  console.error('[Octavia] FATAL: API_KEY environment variable required');
  process.exit(1);
}

const api = axios.create({
  baseURL: HAMH_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
  },
  timeout: 15000,
});

const llm = LLM_API_KEY ? axios.create({
  baseURL: LLM_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${LLM_API_KEY}`,
  },
  timeout: LLM_TIMEOUT,
}) : null;

// ============================================
// LOGGING
// ============================================
function log(level, message) {
  const ts = new Date().toISOString();
  const icon = { info: '👔', task: '📋', delegate: '→', report: '📊', warn: '⚠️', error: '❌', llm: '🤖' }[level] || '•';
  console.log(`[${ts}] ${icon} [Octavia] ${message}`);
}

// ============================================
// LLM CLIENT (Optional)
// ============================================

async function callLLM(systemPrompt, userPrompt, options = {}) {
  if (!llm) return null;
  const maxTokens = options.maxTokens || 1500;
  const temperature = options.temperature ?? 0.5;

  try {
    const { data } = await llm.post('/chat/completions', {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const tokens = data.usage?.total_tokens || 0;
    return { content, tokens, success: true };
  } catch (error) {
    const msg = error.response?.data?.error?.message || error.message;
    log('warn', `LLM call failed: ${msg}`);
    return null;
  }
}

// ============================================
// TASK PROCESSORS
// ============================================

async function processManagerTask(task) {
  log('task', `Processing: ${task.description} (ID: ${task.id})`);

  const desc = task.description.toLowerCase();

  // Auto-delegation patterns
  const delegationPatterns = [
    { regex: /@?miah/, target: 'miah' },
    { regex: /@?markus/, target: 'markus' },
    { regex: /@?mitch/, target: 'mitch' },
    { regex: /@?ruth/, target: 'ruth' },
    { regex: /@?nova/, target: 'nova' },
  ];

  for (const pattern of delegationPatterns) {
    if (pattern.regex.test(desc)) {
      await delegateToWorker(task.id, pattern.target, task.description, { approved: task.approvedByManager });
      return;
    }
  }

  // Flow control
  if (desc.includes('pause all')) {
    await api.post('/octavia/flow', { mode: 'manual' });
    await api.post('/octavia/message', { message: 'All agents paused by Director request.' });
    log('report', 'Flow mode set to manual (pause all)');
    return;
  }

  if (desc.includes('resume all')) {
    await api.post('/octavia/flow', { mode: 'auto' });
    await api.post('/octavia/message', { message: 'All agents resumed. Auto-delegation active.' });
    log('report', 'Flow mode set to auto (resume all)');
    return;
  }

  // Status report
  if (desc.includes('status report')) {
    const status = await generateStatusReport();
    await api.post('/octavia/message', { message: status });
    log('report', 'Status report delivered to Director inbox');
    return;
  }

  // Default: acknowledge and store in inbox
  await api.post('/octavia/message', {
    message: `Acknowledged: "${task.description}". No auto-action matched. Reviewing manually.`,
  });
  log('warn', `No auto-action matched for: ${task.description}`);
}

async function delegateToWorker(managerTaskId, targetWorkerId, description, options = {}) {
  try {
    // Check circuit breaker before delegating
    const fleetHealth = await api.get('/fleet/health');
    const workerHealth = fleetHealth.data.workers[targetWorkerId];
    if (workerHealth?.circuitBreaker?.state === 'OPEN') {
      log('warn', `Delegation BLOCKED: ${targetWorkerId} circuit breaker is OPEN`);
      await api.post('/octavia/message', {
        message: `⚠️ Cannot delegate to ${targetWorkerId}: Circuit breaker OPEN. Worker is temporarily disabled due to repeated failures.`,
      }).catch(() => {});
      return null;
    }

    // Check risk tier for approval requirement
    const riskTier = workerHealth?.health?.riskTier || 1;
    if (riskTier >= 3 && !options.approved) {
      log('warn', `Delegation HELD: ${targetWorkerId} is risk tier ${riskTier} — requires director approval`);
      await api.post('/octavia/message', {
        message: `🚨 High-risk task held for approval: "${description}" → ${targetWorkerId} (Tier ${riskTier}). Use CLI: hamh approve ${managerTaskId} or set flow=auto with approval.`,
      }).catch(() => {});
      return null;
    }

    const { data } = await api.post('/octavia/delegate', {
      taskId: managerTaskId,
      targetWorkerId,
      taskData: {
        description,
        directive: 'Auto-delegated by Octavia daemon',
      },
    });
    log('delegate', `Delegated to ${targetWorkerId}: ${description}`);
    return data;
  } catch (error) {
    log('error', `Delegation failed: ${error.response?.data?.error || error.message}`);
  }
}

async function generateStatusReport() {
  try {
    const { data: statusData } = await api.get('/status');
    const { data: fleetData } = await api.get('/fleet/health');
    const workers = Object.entries(statusData.workers);
    const active = workers.filter(([, w]) => w.status === 'active').length;
    const disabled = workers.filter(([, w]) => w.status === 'disabled').length;
    const totalQueued = workers.reduce((sum, [, w]) => sum + w.queueLength, 0);

    // Build raw data for LLM
    const workerDetails = workers.map(([id, w]) => ({
      id,
      name: w.name,
      status: w.status,
      riskTier: w.riskTier || '-',
      queueLength: w.queueLength || 0,
      healthScore: w.health?.score || 100,
      healthStatus: w.health?.status || 'healthy',
      circuitBreaker: w.circuitBreaker?.state || 'CLOSED',
      errorCount: w.health?.errorCount || 0,
    }));

    // Try LLM-enhanced report first
    if (llm) {
      const systemPrompt = `You are Octavia Hermes, the fleet manager at Oddsify Labs. You write concise, actionable status reports for the Director (Jesse Collins). Use bullet points, emojis, and clear section headers. Highlight risks, blockers, and recommended actions.`;

      const userPrompt = `Generate a fleet status report based on this data:

Summary: ${active} active, ${disabled} disabled, ${totalQueued} queued tasks.

Worker details:
${JSON.stringify(workerDetails, null, 2)}

Write a professional status report. Include:
1. Fleet health summary
2. Per-worker status with health scores and circuit breaker states
3. Any workers needing attention
4. Recommended actions`;

      const llmResult = await callLLM(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 1500 });
      if (llmResult?.content) {
        return `📊 *Fleet Status Report* (LLM-enhanced)\n\n${llmResult.content}`;
      }
    }

    // Fallback to template report
    let report = `📊 *Fleet Status Report*\n\n`;
    report += `Active: ${active} | Disabled: ${disabled} | Queued: ${totalQueued}\n\n`;

    for (const [id, w] of workers) {
      const queueStr = w.queueLength > 0 ? `${w.queueLength} queued` : 'idle';
      const healthScore = w.health?.score || 100;
      const healthEmoji = healthScore >= 90 ? '🟢' : healthScore >= 70 ? '🟡' : '🔴';
      const cbState = w.circuitBreaker?.state || 'CLOSED';
      const cbEmoji = cbState === 'CLOSED' ? '' : cbState === 'HALF_OPEN' ? '⚠️' : '🚫';
      report += `${healthEmoji} ${cbEmoji} ${w.name} (T${w.riskTier || '-'}) | ${queueStr} | Health: ${healthScore}%\n`;
    }

    return report;
  } catch (error) {
    return `Status report failed: ${error.message}`;
  }
}

// ============================================
// SCHEDULED JOBS
// ============================================

async function healthCheck() {
  try {
    const { data } = await api.get('/health');
    log('info', `HAMH health check: ${data.status} (uptime: ${Math.floor(data.uptime)}s)`);

    // Also check fleet health and alert on circuit breakers
    const { data: fleet } = await api.get('/fleet/health');
    for (const [wid, info] of Object.entries(fleet.workers)) {
      if (info.circuitBreaker?.state === 'OPEN') {
        log('warn', `${wid} circuit breaker OPEN`);
        await api.post('/octavia/message', {
          message: `🚨 ${wid} circuit breaker is OPEN. Worker disabled due to repeated failures.`,
        }).catch(() => {});
      }
    }
  } catch (error) {
    log('error', `HAMH unreachable: ${error.message}`);
    await api.post('/octavia/message', {
      message: `⚠️ HAMH health check FAILED: ${error.message}`,
    }).catch(() => {});
  }
}

async function autoReport() {
  try {
    const report = await generateStatusReport();
    await api.post('/octavia/message', { message: `🕐 Hourly auto-report\n\n${report}` });
    log('report', 'Hourly auto-report delivered');
  } catch (error) {
    log('error', `Auto-report failed: ${error.message}`);
  }
}

// ============================================
// MAIN LOOPS
// ============================================

let isRunning = true;

async function pollForTasks() {
  while (isRunning) {
    try {
      const { data } = await api.get('/queue/octavia');
      const queue = data.queue || [];

      for (const task of queue) {
        if (task.status === 'queued' || task.status === 'approved') {
          await processManagerTask(task);
        }
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        log('error', `Poll error: ${error.message}`);
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function startScheduledJobs() {
  setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);
  setInterval(autoReport, AUTO_REPORT_INTERVAL_MS);
  log('info', `Scheduled jobs active: health every ${HEALTH_CHECK_INTERVAL_MS}ms, report every ${AUTO_REPORT_INTERVAL_MS}ms`);
}

// ============================================
// STARTUP
// ============================================

async function main() {
  const llmStatus = llm ? `LLM: ${LLM_MODEL}` : 'LLM: disabled (template mode)';
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════════════════╗
║  OCTAVIA DAEMON — LLM-Enhanced                                               ║
║  Hermes Agent Management Hub — Oddsify Labs                                  ║
║  ${llmStatus.padEnd(76)}║
╚═══════════════════════════════════════════════════════════════════════════════════════════╝
  `);

  log('info', `Connecting to HAMH at ${HAMH_BASE_URL}`);
  log('info', `Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Initial health check
  await healthCheck();

  // Start scheduled jobs
  startScheduledJobs();

  // Start polling
  await pollForTasks();
}

process.on('SIGINT', () => {
  log('info', 'Shutting down...');
  isRunning = false;
  setTimeout(() => process.exit(0), 500);
});

process.on('SIGTERM', () => {
  log('info', 'Shutting down...');
  isRunning = false;
  setTimeout(() => process.exit(0), 500);
});

main().catch(err => {
  log('error', `Fatal: ${err.message}`);
  process.exit(1);
});
