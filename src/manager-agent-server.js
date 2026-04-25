/**
 * MANAGER AGENT SERVER
 * Oddsify Labs - CEO Command Center
 * 
 * Responsibilities:
 * - Receive commands from CEO dashboard
 * - Parse @mentions to route tasks (@miah, @markus, @mitch, @ruth)
 * - Manage task queues for each worker
 * - Execute tasks via appropriate transport (SSH, HTTP, etc)
 * - Report status back to dashboard
 * - Support both legacy & new system integration
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const NodeSSH = require('node-ssh');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// ============================================
// PERSISTENCE
// ============================================
const DATA_DIR = path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load state:', err.message);
  }
  return null;
}

function saveState(state) {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('Failed to save state:', err.message);
  }
}

// ============================================
// AUTHENTICATION
// ============================================
const API_KEY = process.env.API_KEY;

function requireAuth(req, res, next) {
  if (!API_KEY) {
    // If no API key is configured, skip auth (development mode)
    return next();
  }
  const provided = req.headers['x-api-key'] || req.query.apiKey;
  if (provided !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized. Provide X-API-Key header.' });
  }
  next();
}

// ============================================
// CONFIGURATION
// ============================================

const WORKERS = {
  octavia: {
    name: 'Octavia Hermes',
    type: 'director-facing',
    transport: 'internal',
    role: 'orchestrator',
    host: null,
    baseUrl: null,
    telegram: '@OctaviaHermesBot',
    capabilities: ['task-orchestration', 'flow-control', 'agent-delegation', 'status-synthesis', 'director-reports', 'writing', 'research', 'admin'],
    description: 'The Manager. The only agent that speaks with the Director (Jesse). Controls task flow between all agents. Writer/Admin/Researcher.',
    isManager: true,
    riskTier: 2
  },
  miah: {
    name: 'Miah Hermes',
    type: 'vps',
    transport: 'poll',
    host: process.env.MIAH_HOST || null,
    baseUrl: null,
    capabilities: ['write-code', 'deploy', 'debug', 'code-review', 'automation'],
    reportsTo: 'octavia',
    riskTier: 3
  },
  markus: {
    name: 'Markus Hermes',
    type: 'local',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['post-x', 'curate-content', 'engagement', 'analytics', 'schedule'],
    reportsTo: 'octavia',
    riskTier: 2
  },
  mitch: {
    name: 'Mitch Hermes',
    type: 'railway',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['sales', 'marketing', 'lead-generation', 'content-strategy', 'analytics', 'crm'],
    reportsTo: 'octavia',
    riskTier: 3
  },
  ruth: {
    name: 'Ruth Hermes',
    type: 'railway',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['web-development', 'frontend', 'backend', 'ui-ux', 'deployment', 'maintenance'],
    reportsTo: 'octavia',
    riskTier: 2
  },
  nova: {
    name: 'Nova Hermes',
    type: 'railway',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['writing', 'research', 'admin', 'content-creation', 'editing', 'summarization', 'fact-check'],
    reportsTo: 'octavia',
    riskTier: 1
  }
};

// Risk Tier Definitions
const RISK_TIERS = {
  1: { label: 'Low Risk', requiresApproval: false, description: 'Info only, no actions' },
  2: { label: 'Medium Risk', requiresApproval: false, description: 'Limited business impact' },
  3: { label: 'High Risk', requiresApproval: true, description: 'Significant impact, requires approval' }
};


// ============================================
// HEALTH TRACKING
// ============================================

class HealthTracker {
  constructor() {
    this.metrics = {};
    this.windowSize = 100;
    this.load();
  }

  load() {
    const saved = loadState();
    if (saved && saved.healthMetrics) {
      this.metrics = saved.healthMetrics;
    }
  }

  save() {
    const state = loadState() || {};
    state.healthMetrics = this.metrics;
    saveState(state);
  }

  recordTask(workerId, task, success, durationMs) {
    if (!this.metrics[workerId]) {
      this.metrics[workerId] = { tasks: [], errors: 0, totalDuration: 0 };
    }
    const m = this.metrics[workerId];
    m.tasks.push({ success, durationMs, timestamp: new Date() });
    if (m.tasks.length > this.windowSize) m.tasks.shift();
    if (!success) m.errors++;
    m.totalDuration += durationMs;
    this.save();
  }

  getHealth(workerId) {
    const m = this.metrics[workerId];
    if (!m || m.tasks.length === 0) {
      return { score: 100, status: 'healthy', successRate: 1.0, avgLatency: 0, errorCount: 0, totalTasks: 0 };
    }
    const total = m.tasks.length;
    const successes = m.tasks.filter(t => t.success).length;
    const successRate = successes / total;
    const avgLatency = m.tasks.reduce((s, t) => s + t.durationMs, 0) / total;
    const score = Math.round(successRate * 100);
    let status = 'healthy';
    if (score < 70) status = 'degraded';
    if (score < 40) status = 'critical';
    return { score, status, successRate: Math.round(successRate * 100) / 100, avgLatency: Math.round(avgLatency), errorCount: m.errors, totalTasks: total };
  }

  getAllHealth() {
    const result = {};
    Object.keys(WORKERS).forEach(id => {
      result[id] = this.getHealth(id);
    });
    return result;
  }
}

// ============================================
// COST TRACKING
// ============================================

class CostTracker {
  constructor() {
    this.dailyCosts = {};
    this.taskCosts = [];
    this.load();
  }

  load() {
    const saved = loadState();
    if (saved && saved.costData) {
      this.dailyCosts = saved.costData.dailyCosts || {};
      this.taskCosts = saved.costData.taskCosts || [];
    }
  }

  save() {
    const state = loadState() || {};
    state.costData = { dailyCosts: this.dailyCosts, taskCosts: this.taskCosts };
    saveState(state);
  }

  recordTask(workerId, taskType, durationMs, tokenEstimate = 0, modelUsed = null) {
    const date = new Date().toISOString().split('T')[0];
    if (!this.dailyCosts[date]) this.dailyCosts[date] = {};
    if (!this.dailyCosts[date][workerId]) {
      this.dailyCosts[date][workerId] = { tokens: 0, tasks: 0, cost: 0 };
    }
    const estimatedCost = tokenEstimate > 0 ? (tokenEstimate / 1000) * 0.003 : 0;
    this.dailyCosts[date][workerId].tokens += tokenEstimate;
    this.dailyCosts[date][workerId].tasks += 1;
    this.dailyCosts[date][workerId].cost += estimatedCost;

    this.taskCosts.push({ workerId, taskType, durationMs, tokenEstimate, modelUsed, date, timestamp: new Date() });
    if (this.taskCosts.length > 100) this.taskCosts.shift();
    this.save();
  }

  getDailySummary(date = null) {
    const d = date || new Date().toISOString().split('T')[0];
    return this.dailyCosts[d] || {};
  }

  getWorkerCosts(workerId, days = 7) {
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({ date: dateStr, ...((this.dailyCosts[dateStr] || {})[workerId] || { tokens: 0, tasks: 0, cost: 0 }) });
    }
    return result;
  }
}

// ============================================
// CIRCUIT BREAKER
// ============================================

class CircuitBreaker {
  constructor() {
    this.states = {};
    this.threshold = parseInt(process.env.CB_THRESHOLD, 10) || 5;
    this.timeoutMs = parseInt(process.env.CB_TIMEOUT_MS, 10) || 60000;
  }

  getState(workerId) {
    return this.states[workerId] || { state: 'CLOSED', failures: 0, lastFailure: null, nextRetry: null };
  }

  recordSuccess(workerId) {
    if (!this.states[workerId]) this.states[workerId] = { state: 'CLOSED', failures: 0 };
    const s = this.states[workerId];
    if (s.state === 'HALF_OPEN') {
      s.state = 'CLOSED';
      s.failures = 0;
      console.log(`[CircuitBreaker] ${workerId} recovered, state: CLOSED`);
    } else {
      s.failures = 0;
    }
  }

  recordFailure(workerId) {
    if (!this.states[workerId]) this.states[workerId] = { state: 'CLOSED', failures: 0 };
    const s = this.states[workerId];
    s.failures++;
    s.lastFailure = new Date();
    if (s.failures >= this.threshold) {
      s.state = 'OPEN';
      s.nextRetry = new Date(Date.now() + this.timeoutMs);
      console.log(`[CircuitBreaker] ${workerId} OPENED due to ${s.failures} failures. Retry after ${s.nextRetry.toISOString()}`);
    }
  }

  canExecute(workerId) {
    const s = this.getState(workerId);
    if (s.state === 'CLOSED') return true;
    if (s.state === 'OPEN') {
      if (new Date() >= s.nextRetry) {
        s.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker] ${workerId} HALF_OPEN, testing...`);
        return true;
      }
      return false;
    }
    return true;
  }

  getStatus() {
    const result = {};
    Object.keys(WORKERS).forEach(id => {
      result[id] = this.getState(id);
    });
    return result;
  }
}

// ============================================
// TASK QUEUE & STATE MANAGEMENT
// ============================================

class TaskQueue {
  constructor() {
    this.queues = {
      octavia: [],
      miah: [],
      markus: [],
      mitch: [],
      ruth: [],
      nova: []
    };
    this.completedTasks = [];
    this.activityLog = [];
    this.managerFlowControl = {
      mode: 'auto', // 'auto' | 'manual'
      pendingApprovals: [],
      agentReports: [],
      directorInbox: []
    };
    this.load();
  }

  load() {
    const saved = loadState();
    if (saved) {
      if (saved.queues) {
        // Merge saved queues with defaults to handle new workers
        this.queues = { ...this.queues, ...saved.queues };
      }
      if (saved.completedTasks) this.completedTasks = saved.completedTasks;
      if (saved.activityLog) this.activityLog = saved.activityLog;
      if (saved.managerFlowControl) this.managerFlowControl = saved.managerFlowControl;
      console.log('State loaded from disk');
    }
  }

  save() {
    saveState({
      queues: this.queues,
      completedTasks: this.completedTasks,
      activityLog: this.activityLog,
      managerFlowControl: this.managerFlowControl
    });
  }

  enqueueTask(workerId, task, options = {}) {
    const taskId = uuidv4();
    const riskTier = WORKERS[workerId]?.riskTier || 1;
    const requiresApproval = (riskTier >= 3 && options.source === 'director') ||
                             (WORKERS[workerId]?.reportsTo === 'octavia' && options.source === 'agent');
    const fullTask = {
      id: taskId,
      workerId,
      traceId: options.traceId || taskId,
      parentTaskId: options.parentTaskId || null,
      ...task,
      status: 'queued',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      source: options.source || 'director',
      approvedByManager: !requiresApproval,
      requiresApproval,
      riskTier,
      tokenUsage: 0,
      modelUsed: null
    };
    
    // If task is from an agent to manager, route to manager queue
    if (workerId === 'octavia' || options.source === 'agent') {
      this.queues.octavia.push(fullTask);
      this.logActivity(`Agent task submitted to Octavia (Manager): ${task.description}`);
    } else {
      this.queues[workerId].push(fullTask);
      this.logActivity(`Task queued for ${WORKERS[workerId].name}: ${task.description}`);
    }
    this.save();
    return fullTask;
  }

  // Manager delegates task to a worker
  delegateTask(managerTaskId, targetWorkerId, taskData) {
    const managerQueue = this.queues.octavia;
    const taskIndex = managerQueue.findIndex(t => t.id === managerTaskId);
    
    if (taskIndex === -1) return null;
    
    const managerTask = managerQueue[taskIndex];
    managerTask.status = 'delegated';
    managerTask.delegatedTo = targetWorkerId;
    managerTask.delegatedAt = new Date();
    
    const delegatedTask = this.enqueueTask(targetWorkerId, {
      description: taskData.description || managerTask.description,
      type: taskData.type || managerTask.type || 'custom',
      parentTaskId: managerTaskId,
      managerDirective: taskData.directive || null
    }, { source: 'octavia' });
    
    this.logActivity(`Manager delegated task to ${WORKERS[targetWorkerId]?.name || targetWorkerId}: ${delegatedTask.description}`);
    this.save();
    return delegatedTask;
  }

  // Manager approves a task from the director
  approveTask(taskId) {
    const queue = this.queues.octavia;
    const task = queue.find(t => t.id === taskId);
    if (!task) return null;
    
    task.approvedByManager = true;
    task.status = 'approved';
    task.approvedAt = new Date();
    
    this.logActivity(`Manager approved task: ${task.description}`);
    this.save();
    return task;
  }

  // Agent reports status back to manager
  agentReport(agentId, report) {
    const reportEntry = {
      id: uuidv4(),
      agentId,
      ...report,
      timestamp: new Date(),
      status: 'unread'
    };
    this.managerFlowControl.agentReports.push(reportEntry);
    if (this.managerFlowControl.agentReports.length > 100) {
      this.managerFlowControl.agentReports.shift();
    }
    this.logActivity(`Report from ${WORKERS[agentId]?.name || agentId}: ${report.summary || 'Status update'}`);
    this.save();
    return reportEntry;
  }

  // Manager sends message to Director
  directorMessage(message) {
    const msg = {
      id: uuidv4(),
      from: 'octavia',
      message,
      timestamp: new Date(),
      status: 'unread'
    };
    this.managerFlowControl.directorInbox.push(msg);
    if (this.managerFlowControl.directorInbox.length > 50) {
      this.managerFlowControl.directorInbox.shift();
    }
    this.logActivity(`Manager → Director: ${message}`);
    this.save();
    return msg;
  }

  getQueue(workerId) {
    return this.queues[workerId];
  }

  getCurrentTask(workerId) {
    return this.queues[workerId][0] || null;
  }

  completeTask(workerId, taskId, result, options = {}) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    task.tokenUsage = options.tokenUsage || task.tokenUsage || 0;
    task.modelUsed = options.modelUsed || task.modelUsed || null;
    const durationMs = task.startedAt ? (task.completedAt - new Date(task.startedAt)) : 0;
    
    this.completedTasks.push(task);
    this.logActivity(`✓ Completed [${workerId}]: ${task.description}`);
    this.save();
    
    // Track health, cost, circuit breaker
    if (healthTracker) healthTracker.recordTask(workerId, task, true, durationMs);
    if (costTracker) costTracker.recordTask(workerId, task.type, durationMs, task.tokenUsage, task.modelUsed);
    if (circuitBreaker) circuitBreaker.recordSuccess(workerId);
    
    // If completed by a worker reporting to manager, notify manager
    if (WORKERS[workerId]?.reportsTo === 'octavia' && task.parentTaskId) {
      this.agentReport(workerId, {
        type: 'task-complete',
        parentTaskId: task.parentTaskId,
        summary: `Task completed: ${task.description}`,
        result
      });
    }
    
    return task;
  }

  failTask(workerId, taskId, error, options = {}) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;
    const durationMs = task.startedAt ? (task.completedAt - new Date(task.startedAt)) : 0;
    
    this.completedTasks.push(task);
    this.logActivity(`✗ Failed [${workerId}]: ${task.description} - ${error}`);
    this.save();
    
    // Track health and circuit breaker
    if (healthTracker) healthTracker.recordTask(workerId, task, false, durationMs);
    if (circuitBreaker) circuitBreaker.recordFailure(workerId);
    
    // If failed by a worker reporting to manager, notify manager
    if (WORKERS[workerId]?.reportsTo === 'octavia' && task.parentTaskId) {
      this.agentReport(workerId, {
        type: 'task-failed',
        parentTaskId: task.parentTaskId,
        summary: `Task failed: ${task.description}`,
        error
      });
    }
    
    return task;
  }

  logActivity(message) {
    this.activityLog.push({
      timestamp: new Date(),
      message
    });
    if (this.activityLog.length > 100) {
      this.activityLog.shift();
    }
  }

  getActivityLog(limit = 20) {
    return this.activityLog.slice(-limit).reverse();
  }

  getManagerStatus() {
    return {
      mode: this.managerFlowControl.mode,
      queueLength: this.queues.octavia.length,
      pendingApprovals: this.queues.octavia.filter(t => !t.approvedByManager && t.source === 'director').length,
      agentReports: this.managerFlowControl.agentReports.filter(r => r.status === 'unread').length,
      directorInbox: this.managerFlowControl.directorInbox.filter(m => m.status === 'unread').length,
      recentReports: this.managerFlowControl.agentReports.slice(-10).reverse(),
      directorMessages: this.managerFlowControl.directorInbox.slice(-10).reverse()
    };
  }

  setFlowControl(mode) {
    this.managerFlowControl.mode = mode;
    this.logActivity(`Manager flow control set to: ${mode}`);
    this.save();
    return this.managerFlowControl.mode;
  }
}

const taskQueue = new TaskQueue();
const healthTracker = new HealthTracker();
const costTracker = new CostTracker();
const circuitBreaker = new CircuitBreaker();

// ============================================
// COMMAND PARSER
// ============================================

class CommandParser {
  static parse(command) {
    const trimmed = command.trim();

    if (trimmed.toLowerCase() === 'status report') {
      return { type: 'status-report' };
    }
    if (trimmed.toLowerCase() === 'pause all') {
      return { type: 'pause-all' };
    }
    if (trimmed.toLowerCase() === 'resume all') {
      return { type: 'resume-all' };
    }

    // Director speaking directly to Octavia (Manager)
    const managerMatch = trimmed.match(/^@octavia\s+(.+)$/i);
    if (managerMatch) {
      return {
        type: 'manager-directive',
        workerId: 'octavia',
        description: managerMatch[1]
      };
    }

    // Agent submitting task to Octavia (Manager)
    const agentToManagerMatch = trimmed.match(/^@octavia\s+from\s+@(miah|markus|mitch|ruth)\s*:\s*(.+)$/i);
    if (agentToManagerMatch) {
      return {
        type: 'agent-to-manager',
        agentId: agentToManagerMatch[1].toLowerCase(),
        description: agentToManagerMatch[2]
      };
    }

    const mentionMatch = trimmed.match(/^@(miah|markus|mitch|ruth|nova|octavia)\s+(.+)$/i);
    if (mentionMatch) {
      const [_, workerId, taskDesc] = mentionMatch;
      return {
        type: 'worker-task',
        workerId: workerId.toLowerCase(),
        description: taskDesc
      };
    }

    return { type: 'unknown', raw: trimmed };
  }

  static getTaskTemplate(workerId, description) {
    const templates = {
      octavia: {
        'delegate': { description: `Delegate: ${description}`, type: 'delegate' },
        'report': { description: `Report: ${description}`, type: 'director-report' },
        'approve': { description: `Approve: ${description}`, type: 'approve' },
        'flow': { description: `Flow control: ${description}`, type: 'flow-control' }
      },
      miah: {
        'deploy': { description: 'Deploy latest code', type: 'deploy' },
        'code': { description: `Write code: ${description}`, type: 'write-code' },
        'debug': { description: `Debug: ${description}`, type: 'debug' },
        'review': { description: `Code review: ${description}`, type: 'code-review' }
      },
      markus: {
        'post': { description: `Post to X: ${description}`, type: 'post-x' },
        'engage': { description: `Engagement: ${description}`, type: 'engagement' },
        'analytics': { description: `Analytics: ${description}`, type: 'analytics' }
      },
      mitch: {
        'lead': { description: `Lead gen: ${description}`, type: 'lead-generation' },
        'sales': { description: `Sales task: ${description}`, type: 'sales' },
        'marketing': { description: `Marketing: ${description}`, type: 'marketing' },
        'crm': { description: `CRM: ${description}`, type: 'crm' }
      },
      ruth: {
        'build': { description: `Build: ${description}`, type: 'web-development' },
        'fix': { description: `Fix: ${description}`, type: 'maintenance' },
        'deploy': { description: `Deploy: ${description}`, type: 'deployment' },
        'ui': { description: `UI/UX: ${description}`, type: 'ui-ux' }
      },
      nova: {
        'write': { description: `Write: ${description}`, type: 'writing' },
        'research': { description: `Research: ${description}`, type: 'research' },
        'summarize': { description: `Summarize: ${description}`, type: 'summarization' },
        'draft': { description: `Draft: ${description}`, type: 'content-creation' },
        'edit': { description: `Edit: ${description}`, type: 'editing' },
        'fact': { description: `Fact-check: ${description}`, type: 'fact-check' },
        'admin': { description: `Admin: ${description}`, type: 'admin' }
      }
    };

    const workerTemplates = templates[workerId] || {};
    const firstWord = description.split(' ')[0].toLowerCase();
    return workerTemplates[firstWord] || { description, type: 'custom' };
  }
}

// ============================================
// TASK EXECUTION (Legacy + New)
// ============================================

class TaskExecutor {
  static async execute(task) {
    const worker = WORKERS[task.workerId];
    
    try {
      let result;

      if (worker.transport === 'ssh') {
        result = await this.executeSsh(task, worker);
      } else if (worker.transport === 'http') {
        result = await this.executeHttp(task, worker);
      } else {
        throw new Error(`Worker ${worker.name} uses polling and must pick up tasks via /api/tasks/poll`);
      }

      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async executeSsh(task, worker) {
    const ssh = new NodeSSH();
    
    try {
      await ssh.connect({
        host: worker.host,
        username: worker.user,
        privateKey: require('fs').readFileSync(worker.privateKey),
        readyTimeout: 10000
      });

      const commands = {
        'deploy': 'cd /app/miah-hermes && npm run deploy',
        'write-code': `cd /app/miah-hermes && npm run task -- "${task.description}"`,
        'debug': `cd /app/miah-hermes && npm run debug -- "${task.description}"`,
        'code-review': `cd /app/miah-hermes && npm run review -- "${task.description}"`,
        'automation': `cd /app/miah-hermes && npm run automate -- "${task.description}"`
      };

      const command = commands[task.type] || `echo "Task: ${task.description}"`;
      const result = await ssh.execCommand(command);

      ssh.dispose();

      if (result.code === 0) {
        return { status: 'success', output: result.stdout };
      } else {
        throw new Error(result.stderr || 'SSH command failed');
      }
    } catch (error) {
      throw new Error(`SSH execution failed: ${error.message}`);
    }
  }

  static async executeHttp(task, worker) {
    try {
      const response = await axios.post(`${worker.baseUrl}/task`, {
        taskId: task.id,
        type: task.type,
        description: task.description,
        timestamp: new Date()
      }, {
        headers: worker.apiKey ? { 'Authorization': `Bearer ${worker.apiKey}` } : {},
        timeout: 30000
      });

      return {
        status: 'success',
        taskId: response.data.taskId,
        data: response.data
      };
    } catch (error) {
      throw new Error(`HTTP execution failed: ${error.message}`);
    }
  }
}

// ============================================
// API ENDPOINTS
// ============================================

app.post('/command', requireAuth, async (req, res) => {
  const { command, source = 'director' } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Command required' });
  }

  try {
    const parsed = CommandParser.parse(command);
    
    // Log source appropriately
    const sourceLabel = source === 'director' ? 'Director' : source;
    taskQueue.logActivity(`${sourceLabel} Command: ${command}`);

    if (parsed.type === 'unknown') {
      return res.status(400).json({ error: 'Could not parse command', command });
    }

    if (parsed.type === 'status-report') {
      return res.json({
        type: 'status-report',
        queues: {
          octavia: taskQueue.getQueue('octavia'),
          miah: taskQueue.getQueue('miah'),
          markus: taskQueue.getQueue('markus'),
          mitch: taskQueue.getQueue('mitch'),
          ruth: taskQueue.getQueue('ruth'),
          nova: taskQueue.getQueue('nova')
        },
        manager: taskQueue.getManagerStatus(),
        timestamp: new Date()
      });
    }

    if (parsed.type === 'pause-all' || parsed.type === 'resume-all') {
      taskQueue.logActivity(parsed.type === 'pause-all' ? 'Pausing all agents' : 'Resuming all agents');
      return res.json({ type: parsed.type, status: 'acknowledged' });
    }

    // Director speaking to Octavia
    if (parsed.type === 'manager-directive') {
      const taskTemplate = CommandParser.getTaskTemplate('octavia', parsed.description);
      const task = taskQueue.enqueueTask('octavia', taskTemplate, { source: 'director' });

      // Auto-acknowledge to Director Inbox
      taskQueue.directorMessage(`Acknowledged: "${parsed.description}". Task queued for processing.`);

      // In auto mode, manager auto-approves and delegates
      if (taskQueue.managerFlowControl.mode === 'auto') {
        taskQueue.approveTask(task.id);

        // Simple auto-delegation: if directive mentions an agent, delegate there
        const targetAgent = ['miah', 'markus', 'mitch', 'ruth', 'nova'].find(id =>
          parsed.description.toLowerCase().includes(id)
        );

        if (targetAgent) {
          const delegated = taskQueue.delegateTask(task.id, targetAgent, {
            description: parsed.description,
            directive: 'Auto-delegated from Director via Manager'
          });

          // Execute the delegated task
          const execution = await TaskExecutor.execute(delegated);
          if (execution.success) {
            taskQueue.completeTask(targetAgent, delegated.id, execution.result);
          } else {
            taskQueue.failTask(targetAgent, delegated.id, execution.error);
          }

          // Notify Director of delegation
          taskQueue.directorMessage(`Delegated to ${WORKERS[targetAgent]?.name || targetAgent}: ${parsed.description}`);

          return res.json({
            status: 'success',
            flow: 'director → octavia → agent',
            managerTask: task,
            delegatedTask: delegated,
            result: execution.result || execution.error
          });
        }
      }

      return res.json({
        status: 'success',
        flow: 'director → octavia',
        task,
        mode: taskQueue.managerFlowControl.mode,
        message: taskQueue.managerFlowControl.mode === 'manual'
          ? 'Task queued for Octavia approval'
          : 'Task acknowledged by Octavia'
      });
    }

    // Agent submitting task to Octavia
    if (parsed.type === 'agent-to-manager') {
      const { agentId, description } = parsed;

      const task = taskQueue.enqueueTask('octavia', {
        description: `From ${WORKERS[agentId]?.name || agentId}: ${description}`,
        type: 'agent-request',
        requestingAgent: agentId
      }, { source: 'agent' });

      // Notify Director that an agent submitted something to Octavia
      taskQueue.directorMessage(`🔔 ${WORKERS[agentId]?.name || agentId} submitted a request: "${description}"`);

      return res.json({
        status: 'success',
        flow: 'agent → octavia',
        task,
        message: 'Request submitted to Octavia'
      });
    }

    if (parsed.type === 'worker-task') {
      const { workerId, description } = parsed;

      if (!WORKERS[workerId]) {
        return res.status(400).json({ error: `Unknown worker: ${workerId}` });
      }

      const taskTemplate = CommandParser.getTaskTemplate(workerId, description);
      const task = taskQueue.enqueueTask(workerId, taskTemplate, { source });

      // Polling workers pick up tasks themselves — do not auto-execute
      if (WORKERS[workerId].transport === 'poll') {
        return res.json({
          status: 'queued',
          task,
          message: `Task queued for ${WORKERS[workerId].name}. Worker will poll and pick it up.`
        });
      }

      const execution = await TaskExecutor.execute(task);

      if (execution.success) {
        taskQueue.completeTask(workerId, task.id, execution.result);
        return res.json({
          status: 'success',
          task,
          result: execution.result
        });
      } else {
        taskQueue.failTask(workerId, task.id, execution.error);
        return res.status(500).json({
          status: 'failed',
          task,
          error: execution.error
        });
      }
    }

    res.status(400).json({ error: 'Unhandled command type', parsed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/status', (req, res) => {
  const health = healthTracker ? healthTracker.getAllHealth() : {};
  const cb = circuitBreaker ? circuitBreaker.getStatus() : {};
  
  res.json({
    timestamp: new Date(),
    workers: {
      octavia: {
        name: WORKERS.octavia.name,
        type: WORKERS.octavia.type,
        status: 'active',
        queueLength: taskQueue.getQueue('octavia').length,
        currentTask: taskQueue.getCurrentTask('octavia'),
        riskTier: WORKERS.octavia.riskTier,
        health: health.octavia,
        circuitBreaker: cb.octavia
      },
      miah: {
        name: WORKERS.miah.name,
        type: WORKERS.miah.type,
        status: (cb.miah && cb.miah.state === 'OPEN') ? 'disabled' : 'active',
        queueLength: taskQueue.getQueue('miah').length,
        currentTask: taskQueue.getCurrentTask('miah'),
        riskTier: WORKERS.miah.riskTier,
        health: health.miah,
        circuitBreaker: cb.miah
      },
      markus: {
        name: WORKERS.markus.name,
        type: WORKERS.markus.type,
        status: (cb.markus && cb.markus.state === 'OPEN') ? 'disabled' : 'active',
        queueLength: taskQueue.getQueue('markus').length,
        currentTask: taskQueue.getCurrentTask('markus'),
        riskTier: WORKERS.markus.riskTier,
        health: health.markus,
        circuitBreaker: cb.markus
      },
      mitch: {
        name: WORKERS.mitch.name,
        type: WORKERS.mitch.type,
        status: (cb.mitch && cb.mitch.state === 'OPEN') ? 'disabled' : 'active',
        queueLength: taskQueue.getQueue('mitch').length,
        currentTask: taskQueue.getCurrentTask('mitch'),
        riskTier: WORKERS.mitch.riskTier,
        health: health.mitch,
        circuitBreaker: cb.mitch
      },
      ruth: {
        name: WORKERS.ruth.name,
        type: WORKERS.ruth.type,
        status: (cb.ruth && cb.ruth.state === 'OPEN') ? 'disabled' : 'active',
        queueLength: taskQueue.getQueue('ruth').length,
        currentTask: taskQueue.getCurrentTask('ruth'),
        riskTier: WORKERS.ruth.riskTier,
        health: health.ruth,
        circuitBreaker: cb.ruth
      },
      nova: {
        name: WORKERS.nova.name,
        type: WORKERS.nova.type,
        status: (cb.nova && cb.nova.state === 'OPEN') ? 'disabled' : 'active',
        queueLength: taskQueue.getQueue('nova').length,
        currentTask: taskQueue.getCurrentTask('nova'),
        riskTier: WORKERS.nova.riskTier,
        health: health.nova,
        circuitBreaker: cb.nova
      }
    },
    activityLog: taskQueue.getActivityLog(20)
  });
});

app.get('/queue/:workerId', (req, res) => {
  const { workerId } = req.params;

  if (!WORKERS[workerId]) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  res.json({
    workerId,
    queue: taskQueue.getQueue(workerId),
    current: taskQueue.getCurrentTask(workerId)
  });
});

app.get('/activity', (req, res) => {
  const limit = req.query.limit || 50;
  res.json({ log: taskQueue.getActivityLog(limit) });
});

app.post('/legacy/task', requireAuth, (req, res) => {
  const { agentId, action, params } = req.body;

  const legacyMap = {
    'coder': 'miah',
    'social': 'markus',
    'sales': 'mitch',
    'web': 'ruth',
    'writer': 'nova'
  };

  const workerId = legacyMap[agentId];
  if (!workerId) {
    return res.status(400).json({ error: 'Unknown legacy agent' });
  }

  const task = taskQueue.enqueueTask(workerId, {
    description: `${action}: ${JSON.stringify(params)}`,
    type: action,
    legacy: true,
    legacyAgentId: agentId
  });

  res.json({ status: 'queued', task });
});

app.get('/legacy/status/:agentId', (req, res) => {
  const { agentId } = req.params;
  
  const legacyMap = {
    'coder': 'miah',
    'social': 'markus',
    'sales': 'mitch',
    'web': 'ruth',
    'writer': 'nova'
  };

  const workerId = legacyMap[agentId];
  if (!workerId) {
    return res.status(404).json({ error: 'Unknown legacy agent' });
  }

  const queue = taskQueue.getQueue(workerId);
  
  res.json({
    agentId,
    status: 'active',
    queueLength: queue.length,
    tasks: queue.slice(0, 5)
  });
});

// ============================================
// POLLING WORKER API
// ============================================

// Workers poll this endpoint to get their next task
app.get('/api/tasks/poll', (req, res) => {
  const { agent } = req.query;

  if (!agent || !WORKERS[agent]) {
    return res.status(400).json({ error: 'Valid agent query param required' });
  }

  // Circuit breaker check
  if (circuitBreaker && !circuitBreaker.canExecute(agent)) {
    const cb = circuitBreaker.getState(agent);
    return res.status(503).json({
      error: 'Circuit breaker OPEN',
      state: cb.state,
      nextRetry: cb.nextRetry,
      message: `Worker ${agent} is temporarily disabled due to failures. Retry after ${cb.nextRetry}`
    });
  }

  const queue = taskQueue.queues[agent];
  const pendingTask = queue.find(t => t.status === 'queued');

  if (!pendingTask) {
    return res.status(204).send();
  }

  // Mark as in-progress so it's not picked up again
  pendingTask.status = 'in-progress';
  pendingTask.startedAt = new Date();
  taskQueue.save();

  res.json({
    task: {
      id: pendingTask.id,
      workerId: pendingTask.workerId,
      description: pendingTask.description,
      type: pendingTask.type,
      source: pendingTask.source,
      traceId: pendingTask.traceId,
      parentTaskId: pendingTask.parentTaskId,
      createdAt: pendingTask.createdAt,
      parameters: pendingTask.parameters || {}
    }
  });
});

// Workers submit results back here
app.post('/api/tasks/:taskId/complete', requireAuth, (req, res) => {
  const { taskId } = req.params;
  const { workerId, result, tokenUsage, modelUsed } = req.body;

  if (!workerId || !WORKERS[workerId]) {
    return res.status(400).json({ error: 'Invalid worker' });
  }

  const task = taskQueue.completeTask(workerId, taskId, result, { tokenUsage, modelUsed });

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ status: 'completed', task });
});

// Workers report failures here
app.post('/api/tasks/:taskId/fail', requireAuth, (req, res) => {
  const { taskId } = req.params;
  const { workerId, error } = req.body;

  if (!workerId || !WORKERS[workerId]) {
    return res.status(400).json({ error: 'Invalid worker' });
  }

  const task = taskQueue.failTask(workerId, taskId, error);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ status: 'failed', task });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// ============================================
// MANAGER AGENT ENDPOINTS
// ============================================

// Get manager status and flow control state
app.get('/octavia/status', (req, res) => {
  res.json({
    status: 'success',
    octavia: taskQueue.getManagerStatus(),
    workers: Object.entries(WORKERS).reduce((acc, [id, w]) => {
      acc[id] = {
        name: w.name,
        type: w.type,
        role: w.role || 'worker',
        reportsTo: w.reportsTo || null,
        capabilities: w.capabilities,
        status: 'active',
        queueLength: taskQueue.getQueue(id).length
      };
      return acc;
    }, {}),
    timestamp: new Date()
  });
});

// Set manager flow control mode (auto / manual)
app.post('/octavia/flow', requireAuth, (req, res) => {
  const { mode } = req.body;
  if (!mode || !['auto', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be "auto" or "manual"' });
  }
  const newMode = taskQueue.setFlowControl(mode);
  res.json({ status: 'success', mode: newMode });
});

// Manager delegates a task to a worker
app.post('/octavia/delegate', requireAuth, async (req, res) => {
  const { taskId, targetWorkerId, taskData } = req.body;

  if (!taskId || !targetWorkerId || !WORKERS[targetWorkerId]) {
    return res.status(400).json({ error: 'Invalid taskId or targetWorkerId' });
  }

  try {
    const delegated = taskQueue.delegateTask(taskId, targetWorkerId, taskData || {});
    if (!delegated) {
      return res.status(404).json({ error: 'Manager task not found' });
    }

    // Polling workers pick up tasks themselves — do not auto-execute
    if (WORKERS[targetWorkerId].transport === 'poll') {
      return res.json({
        status: 'success',
        flow: 'manager → agent (poll)',
        delegatedTask: delegated,
        message: 'Task delegated. Worker will poll and pick it up.'
      });
    }

    // Execute if in auto mode for non-polling workers
    const execution = await TaskExecutor.execute(delegated);
    if (execution.success) {
      taskQueue.completeTask(targetWorkerId, delegated.id, execution.result);
    } else {
      taskQueue.failTask(targetWorkerId, delegated.id, execution.error);
    }

    res.json({
      status: 'success',
      flow: 'manager → agent',
      delegatedTask: delegated,
      execution: execution.success ? 'completed' : 'failed',
      result: execution.result || execution.error
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manager approves a task
app.post('/octavia/approve', requireAuth, (req, res) => {
  const { taskId } = req.body;
  if (!taskId) {
    return res.status(400).json({ error: 'taskId required' });
  }

  const task = taskQueue.approveTask(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ status: 'success', task });
});

// Agent submits report to manager
app.post('/octavia/report', requireAuth, (req, res) => {
  const { agentId, type, summary, result, error } = req.body;

  if (!agentId || !WORKERS[agentId]) {
    return res.status(400).json({ error: 'Invalid agentId' });
  }

  const report = taskQueue.agentReport(agentId, {
    type: type || 'status-update',
    summary: summary || 'Status update',
    result,
    error
  });

  res.json({ status: 'success', report });
});

// Manager sends message to Director
app.post('/octavia/message', requireAuth, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  const msg = taskQueue.directorMessage(message);
  res.json({ status: 'success', message: msg });
});

// Director reads manager messages
app.get('/octavia/inbox', (req, res) => {
  const { status } = req.query;
  let messages = taskQueue.managerFlowControl.directorInbox;
  if (status) {
    messages = messages.filter(m => m.status === status);
  }
  res.json({
    status: 'success',
    messages: messages.slice(-20).reverse(),
    unreadCount: messages.filter(m => m.status === 'unread').length
  });
});

// Mark director inbox message as read
app.post('/octavia/inbox/:messageId/read', requireAuth, (req, res) => {
  const { messageId } = req.params;
  const msg = taskQueue.managerFlowControl.directorInbox.find(m => m.id === messageId);
  if (!msg) {
    return res.status(404).json({ error: 'Message not found' });
  }
  msg.status = 'read';
  res.json({ status: 'success', message: msg });
});

// Get agent reports for manager
app.get('/octavia/reports', (req, res) => {
  const { agentId, status } = req.query;
  let reports = taskQueue.managerFlowControl.agentReports;
  if (agentId) {
    reports = reports.filter(r => r.agentId === agentId);
  }
  if (status) {
    reports = reports.filter(r => r.status === status);
  }
  res.json({
    status: 'success',
    reports: reports.slice(-20).reverse(),
    unreadCount: reports.filter(r => r.status === 'unread').length
  });
});

// Mark agent report as read
app.post('/octavia/reports/:reportId/read', requireAuth, (req, res) => {
  const { reportId } = req.params;
  const report = taskQueue.managerFlowControl.agentReports.find(r => r.id === reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  report.status = 'read';
  res.json({ status: 'success', report });
});


// ============================================
// HEALTH, COSTS, TRACING & CIRCUIT BREAKERS
// ============================================

app.get('/workers/:workerId/health', (req, res) => {
  const { workerId } = req.params;
  if (!WORKERS[workerId]) {
    return res.status(404).json({ error: 'Worker not found' });
  }
  res.json({
    workerId,
    name: WORKERS[workerId].name,
    riskTier: WORKERS[workerId].riskTier,
    health: healthTracker.getHealth(workerId),
    circuitBreaker: circuitBreaker.getState(workerId)
  });
});

app.get('/workers/:workerId/costs', (req, res) => {
  const { workerId } = req.params;
  if (!WORKERS[workerId]) {
    return res.status(404).json({ error: 'Worker not found' });
  }
  const days = parseInt(req.query.days, 10) || 7;
  res.json({
    workerId,
    name: WORKERS[workerId].name,
    daily: costTracker.getWorkerCosts(workerId, days),
    today: costTracker.getDailySummary()
  });
});

app.get('/circuit-breakers', (req, res) => {
  res.json({
    timestamp: new Date(),
    threshold: circuitBreaker.threshold,
    timeoutMs: circuitBreaker.timeoutMs,
    workers: circuitBreaker.getStatus()
  });
});

app.post('/circuit-breakers/:workerId/reset', requireAuth, (req, res) => {
  const { workerId } = req.params;
  if (!WORKERS[workerId]) {
    return res.status(404).json({ error: 'Worker not found' });
  }
  circuitBreaker.states[workerId] = { state: 'CLOSED', failures: 0, lastFailure: null, nextRetry: null };
  taskQueue.logActivity(`Circuit breaker manually reset for ${WORKERS[workerId].name}`);
  res.json({ status: 'reset', workerId });
});

app.get('/tracing/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  let task = null;
  for (const wid of Object.keys(WORKERS)) {
    task = taskQueue.getQueue(wid).find(t => t.id === taskId || t.traceId === taskId);
    if (task) break;
  }
  if (!task) {
    task = taskQueue.completedTasks.find(t => t.id === taskId || t.traceId === taskId);
  }
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const traceId = task.traceId || task.id;
  const chain = [];
  
  for (const wid of Object.keys(WORKERS)) {
    const queued = taskQueue.getQueue(wid).filter(t => (t.traceId || t.id) === traceId);
    const completed = taskQueue.completedTasks.filter(t => (t.traceId || t.id) === traceId);
    chain.push(...queued, ...completed);
  }
  
  chain.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  
  res.json({
    traceId,
    taskCount: chain.length,
    chain: chain.map(t => ({
      id: t.id,
      workerId: t.workerId,
      workerName: WORKERS[t.workerId] && WORKERS[t.workerId].name,
      description: t.description,
      type: t.type,
      status: t.status,
      parentTaskId: t.parentTaskId,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      riskTier: t.riskTier,
      tokenUsage: t.tokenUsage,
      modelUsed: t.modelUsed
    }))
  });
});

app.get('/fleet/health', (req, res) => {
  const health = healthTracker.getAllHealth();
  const cb = circuitBreaker.getStatus();
  const summary = {
    totalWorkers: Object.keys(WORKERS).length,
    healthy: 0,
    degraded: 0,
    critical: 0,
    disabled: 0
  };
  
  Object.keys(WORKERS).forEach(id => {
    if (cb[id] && cb[id].state === 'OPEN') summary.disabled++;
    else if (health[id] && health[id].status === 'healthy') summary.healthy++;
    else if (health[id] && health[id].status === 'degraded') summary.degraded++;
    else if (health[id] && health[id].status === 'critical') summary.critical++;
  });
  
  res.json({
    timestamp: new Date(),
    summary,
    workers: Object.keys(WORKERS).reduce((acc, id) => {
      acc[id] = {
        name: WORKERS[id].name,
        health: health[id],
        circuitBreaker: cb[id]
      };
      return acc;
    }, {})
  });
});

// ============================================
// ROOT ENDPOINT - DASHBOARD HOMEPAGE
// ============================================

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  MANAGER AGENT SERVER                  ║
║  Oddsify Labs - CEO Command Center    ║
║  Running on port ${PORT}                   ║
╚════════════════════════════════════════╝
  `);
  
  taskQueue.logActivity('Manager Agent started');
  console.log('Workers configured:');
  Object.entries(WORKERS).forEach(([id, w]) => {
    console.log(`  - ${w.name} (${w.transport})`);
  });
});

module.exports = app;
