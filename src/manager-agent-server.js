/**
 * MANAGER AGENT SERVER
 * Oddsify Labs - CEO Command Center
 * 
 * Responsibilities:
 * - Receive commands from CEO dashboard
 * - Parse @mentions to route tasks (@miah, @markus, @alexbet)
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
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// CONFIGURATION
// ============================================

const WORKERS = {
  miah: {
    name: 'Miah Hermes',
    type: 'vps',
    transport: 'ssh',
    host: process.env.MIAH_HOST || 'your-vps-ip',
    user: process.env.MIAH_USER || 'root',
    privateKey: process.env.MIAH_KEY_PATH || '/home/manager/.ssh/miah_key',
    baseUrl: null, // SSH only
    capabilities: ['write-code', 'deploy', 'debug', 'code-review', 'automation']
  },
  markus: {
    name: 'Markus Bot',
    type: 'local',
    transport: 'http',
    host: null,
    baseUrl: process.env.MARKUS_API || 'http://localhost:3001',
    capabilities: ['post-x', 'curate-content', 'engagement', 'analytics', 'schedule']
  },
  alexbet: {
    name: 'Alexbet Sharp V2',
    type: 'railway',
    transport: 'http',
    baseUrl: process.env.ALEXBET_API || 'https://alexbet-sharp.railway.app',
    apiKey: process.env.ALEXBET_KEY,
    capabilities: ['scan-markets', 'kelly-sizing', 'edge-detection', 'alerts', 'pnl-tracking']
  }
};

// ============================================
// TASK QUEUE & STATE MANAGEMENT
// ============================================

class TaskQueue {
  constructor() {
    this.queues = {
      miah: [],
      markus: [],
      alexbet: []
    };
    this.completedTasks = [];
    this.activityLog = [];
  }

  enqueueTask(workerId, task) {
    const taskId = uuidv4();
    const fullTask = {
      id: taskId,
      workerId,
      ...task,
      status: 'queued',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null
    };
    
    this.queues[workerId].push(fullTask);
    this.logActivity(`Task queued for ${WORKERS[workerId].name}: ${task.description}`);
    return fullTask;
  }

  getQueue(workerId) {
    return this.queues[workerId];
  }

  getCurrentTask(workerId) {
    return this.queues[workerId][0] || null;
  }

  completeTask(workerId, taskId, result) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    
    this.completedTasks.push(task);
    this.logActivity(`✓ Completed: ${task.description}`);
    return task;
  }

  failTask(workerId, taskId, error) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;
    
    this.completedTasks.push(task);
    this.logActivity(`✗ Failed: ${task.description} - ${error}`);
    return task;
  }

  logActivity(message) {
    this.activityLog.push({
      timestamp: new Date(),
      message
    });
    // Keep last 100 logs
    if (this.activityLog.length > 100) {
      this.activityLog.shift();
    }
  }

  getActivityLog(limit = 20) {
    return this.activityLog.slice(-limit).reverse();
  }
}

const taskQueue = new TaskQueue();

// ============================================
// COMMAND PARSER
// ============================================

class CommandParser {
  /**
   * Parse CEO command like:
   * - "@miah deploy code"
   * - "@markus post earnings update"
   * - "@alexbet scan NFL markets"
   * - "status report"
   * - "pause all"
   */
  static parse(command) {
    const trimmed = command.trim();

    // Global commands
    if (trimmed.toLowerCase() === 'status report') {
      return { type: 'status-report' };
    }
    if (trimmed.toLowerCase() === 'pause all') {
      return { type: 'pause-all' };
    }
    if (trimmed.toLowerCase() === 'resume all') {
      return { type: 'resume-all' };
    }

    // @worker commands
    const mentionMatch = trimmed.match(/^@(miah|markus|alexbet)\s+(.+)$/i);
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
      alexbet: {
        'scan': { description: `Scan markets: ${description}`, type: 'scan-markets' },
        'kelly': { description: `Kelly sizing: ${description}`, type: 'kelly-sizing' },
        'alert': { description: `Alert: ${description}`, type: 'alerts' }
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
  /**
   * Execute task on worker via appropriate transport
   */
  static async execute(task) {
    const worker = WORKERS[task.workerId];
    
    try {
      let result;

      if (worker.transport === 'ssh') {
        result = await this.executeSsh(task, worker);
      } else if (worker.transport === 'http') {
        result = await this.executeHttp(task, worker);
      } else {
        throw new Error(`Unknown transport: ${worker.transport}`);
      }

      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute via SSH (for Miah Hermes on VPS)
   */
  static async executeSsh(task, worker) {
    const ssh = new NodeSSH();
    
    try {
      await ssh.connect({
        host: worker.host,
        username: worker.user,
        privateKey: require('fs').readFileSync(worker.privateKey),
        readyTimeout: 10000
      });

      // Map task types to bash commands
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

  /**
   * Execute via HTTP (for Markus & Alexbet)
   */
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

/**
 * POST /command
 * Receive CEO command from dashboard
 */
app.post('/command', async (req, res) => {
  const { command } = req.body;

  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Command required' });
  }

  try {
    const parsed = CommandParser.parse(command);
    taskQueue.logActivity(`CEO Command: ${command}`);

    if (parsed.type === 'unknown') {
      return res.status(400).json({ error: 'Could not parse command', command });
    }

    if (parsed.type === 'status-report') {
      return res.json({
        type: 'status-report',
        queues: {
          miah: taskQueue.getQueue('miah'),
          markus: taskQueue.getQueue('markus'),
          alexbet: taskQueue.getQueue('alexbet')
        },
        timestamp: new Date()
      });
    }

    if (parsed.type === 'pause-all' || parsed.type === 'resume-all') {
      taskQueue.logActivity(parsed.type === 'pause-all' ? 'Pausing all agents' : 'Resuming all agents');
      return res.json({ type: parsed.type, status: 'acknowledged' });
    }

    if (parsed.type === 'worker-task') {
      const { workerId, description } = parsed;

      // Validate worker exists
      if (!WORKERS[workerId]) {
        return res.status(400).json({ error: `Unknown worker: ${workerId}` });
      }

      // Create task
      const taskTemplate = CommandParser.getTaskTemplate(workerId, description);
      const task = taskQueue.enqueueTask(workerId, taskTemplate);

      // Execute immediately (or queue for processing)
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

/**
 * GET /status
 * Get current system status (for dashboard)
 */
app.get('/status', (req, res) => {
  res.json({
    timestamp: new Date(),
    workers: {
      miah: {
        name: WORKERS.miah.name,
        status: 'active', // TODO: ping worker
        queueLength: taskQueue.getQueue('miah').length,
        currentTask: taskQueue.getCurrentTask('miah')
      },
      markus: {
        name: WORKERS.markus.name,
        status: 'active',
        queueLength: taskQueue.getQueue('markus').length,
        currentTask: taskQueue.getCurrentTask('markus')
      },
      alexbet: {
        name: WORKERS.alexbet.name,
        status: 'active',
        queueLength: taskQueue.getQueue('alexbet').length,
        currentTask: taskQueue.getCurrentTask('alexbet')
      }
    },
    activityLog: taskQueue.getActivityLog(20)
  });
});

/**
 * GET /queue/:workerId
 * Get queue for specific worker
 */
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

/**
 * POST /task/:taskId/complete
 * Worker reports task completion (webhook from worker)
 */
app.post('/task/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  const { workerId, result } = req.body;

  if (!workerId || !WORKERS[workerId]) {
    return res.status(400).json({ error: 'Invalid worker' });
  }

  const task = taskQueue.completeTask(workerId, taskId, result);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ status: 'completed', task });
});

/**
 * POST /task/:taskId/fail
 * Worker reports task failure
 */
app.post('/task/:taskId/fail', (req, res) => {
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

/**
 * GET /activity
 * Get activity log
 */
app.get('/activity', (req, res) => {
  const limit = req.query.limit || 50;
  res.json({ log: taskQueue.getActivityLog(limit) });
});

// ============================================
// LEGACY INTEGRATION ENDPOINTS
// ============================================

/**
 * POST /legacy/task
 * Accept tasks from existing system
 */
app.post('/legacy/task', (req, res) => {
  const { agentId, action, params } = req.body;

  // Map legacy agent IDs to new worker IDs
  const legacyMap = {
    'coder': 'miah',
    'social': 'markus',
    'betting': 'alexbet'
  };

  const workerId = legacyMap[agentId];
  if (!workerId) {
    return res.status(400).json({ error: 'Unknown legacy agent' });
  }

  // Convert legacy action to new format
  const task = taskQueue.enqueueTask(workerId, {
    description: `${action}: ${JSON.stringify(params)}`,
    type: action,
    legacy: true,
    legacyAgentId: agentId
  });

  res.json({ status: 'queued', task });
});

/**
 * GET /legacy/status/:agentId
 * Legacy status endpoint
 */
app.get('/legacy/status/:agentId', (req, res) => {
  const { agentId } = req.params;
  
  const legacyMap = {
    'coder': 'miah',
    'social': 'markus',
    'betting': 'alexbet'
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
    tasks: queue.slice(0, 5) // Return first 5 queued tasks
  });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
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
