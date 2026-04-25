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
// TELEGRAM NOTIFICATIONS
// ============================================

async function notifyDirector(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.JESSE_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('[Notify] Telegram not configured:', message);
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      },
      { timeout: 15000 }
    );
  } catch (error) {
    console.error('[Notify] Failed to send Telegram message:', error.message);
  }
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
    isManager: true
  },
  miah: {
    name: 'Miah Hermes',
    type: 'vps',
    transport: 'poll',
    host: process.env.MIAH_HOST || null,
    baseUrl: null,
    capabilities: ['write-code', 'deploy', 'debug', 'code-review', 'automation'],
    reportsTo: 'octavia'
  },
  markus: {
    name: 'Markus Hermes',
    type: 'local',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['post-x', 'curate-content', 'engagement', 'analytics', 'schedule'],
    reportsTo: 'octavia'
  },
  mitch: {
    name: 'Mitch Hermes',
    type: 'railway',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['sales', 'marketing', 'lead-generation', 'content-strategy', 'analytics', 'crm'],
    reportsTo: 'octavia'
  },
  ruth: {
    name: 'Ruth Hermes',
    type: 'railway',
    transport: 'poll',
    host: null,
    baseUrl: null,
    capabilities: ['web-development', 'frontend', 'backend', 'ui-ux', 'deployment', 'maintenance'],
    reportsTo: 'octavia'
  }
};

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
      ruth: []
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
      if (saved.queues) this.queues = saved.queues;
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
    const fullTask = {
      id: taskId,
      workerId,
      ...task,
      status: 'queued',
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      source: options.source || 'director',
      approvedByManager: options.source === 'director' ? false : true,
      requiresApproval: WORKERS[workerId]?.reportsTo === 'octavia' && options.source === 'agent'
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

  completeTask(workerId, taskId, result) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'completed';
    task.completedAt = new Date();
    task.result = result;
    
    this.completedTasks.push(task);
    this.logActivity(`✓ Completed [${workerId}]: ${task.description}`);
    this.save();
    
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

  failTask(workerId, taskId, error) {
    const queue = this.queues[workerId];
    const taskIndex = queue.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) return null;
    
    const task = queue.splice(taskIndex, 1)[0];
    task.status = 'failed';
    task.completedAt = new Date();
    task.error = error;
    
    this.completedTasks.push(task);
    this.logActivity(`✗ Failed [${workerId}]: ${task.description} - ${error}`);
    this.save();
    
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

    const mentionMatch = trimmed.match(/^@(miah|markus|mitch|ruth|octavia)\s+(.+)$/i);
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
      } else if (worker.transport === 'telegram') {
        result = await this.executeTelegram(task, worker);
      } else {
        throw new Error(`Unknown transport: ${worker.transport}`);
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

  static async executeTelegram(task, worker) {
    try {
      if (!worker.botToken || !worker.chatId) {
        throw new Error('Telegram bot token or chat ID not configured');
      }

      const text = `🚀 *HAMH Task for Markus*

*Task ID:* \`${task.id}\`
*Type:* ${task.type}
*From:* ${task.source || 'Director'}

${task.description}

_Reply with \`/done ${task.id}\` when complete._
      `.trim();

      const response = await axios.post(
        `https://api.telegram.org/bot${worker.botToken}/sendMessage`,
        {
          chat_id: worker.chatId,
          text: text,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        },
        { timeout: 15000 }
      );

      if (!response.data.ok) {
        throw new Error(response.data.description || 'Telegram API error');
      }

      return {
        status: 'success',
        telegramMessageId: response.data.result.message_id,
        sentTo: worker.chatId
      };
    } catch (error) {
      throw new Error(`Telegram delivery failed: ${error.message}`);
    }
  }
}

// ============================================
// API ENDPOINTS
// ============================================

app.post('/command', async (req, res) => {
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
          ruth: taskQueue.getQueue('ruth')
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
        const targetAgent = ['miah', 'markus', 'mitch', 'ruth'].find(id =>
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
        const msg = `📋 *Task Queued*\n\n*Agent:* ${WORKERS[workerId].name}\n*Task:* ${task.description}\n*ID:* \`${task.id}\``;
        notifyDirector(msg);
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
  res.json({
    timestamp: new Date(),
    workers: {
      octavia: {
        name: WORKERS.octavia.name,
        type: WORKERS.octavia.type,
        status: 'active',
        queueLength: taskQueue.getQueue('octavia').length,
        currentTask: taskQueue.getCurrentTask('octavia')
      },
      miah: {
        name: WORKERS.miah.name,
        type: WORKERS.miah.type,
        status: 'active',
        queueLength: taskQueue.getQueue('miah').length,
        currentTask: taskQueue.getCurrentTask('miah')
      },
      markus: {
        name: WORKERS.markus.name,
        type: WORKERS.markus.type,
        status: 'active',
        queueLength: taskQueue.getQueue('markus').length,
        currentTask: taskQueue.getCurrentTask('markus')
      },
      mitch: {
        name: WORKERS.mitch.name,
        type: WORKERS.mitch.type,
        status: 'active',
        queueLength: taskQueue.getQueue('mitch').length,
        currentTask: taskQueue.getCurrentTask('mitch')
      },
      ruth: {
        name: WORKERS.ruth.name,
        type: WORKERS.ruth.type,
        status: 'active',
        queueLength: taskQueue.getQueue('ruth').length,
        currentTask: taskQueue.getCurrentTask('ruth')
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

app.post('/legacy/task', (req, res) => {
  const { agentId, action, params } = req.body;

  const legacyMap = {
    'coder': 'miah',
    'social': 'markus',
    'sales': 'mitch',
    'web': 'ruth'
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
    'web': 'ruth'
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
      createdAt: pendingTask.createdAt,
      parameters: pendingTask.parameters || {}
    }
  });
});

// Workers submit results back here
app.post('/api/tasks/:taskId/complete', (req, res) => {
  const { taskId } = req.params;
  const { workerId, result } = req.body;

  if (!workerId || !WORKERS[workerId]) {
    return res.status(400).json({ error: 'Invalid worker' });
  }

  const task = taskQueue.completeTask(workerId, taskId, result);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const msg = `✅ *Task Complete*\n\n*Agent:* ${WORKERS[workerId].name}\n*Task:* ${task.description}\n*Result:* ${typeof result === 'string' ? result : JSON.stringify(result).slice(0, 200)}`;
  notifyDirector(msg);

  res.json({ status: 'completed', task });
});

// Workers report failures here
app.post('/api/tasks/:taskId/fail', (req, res) => {
  const { taskId } = req.params;
  const { workerId, error } = req.body;

  if (!workerId || !WORKERS[workerId]) {
    return res.status(400).json({ error: 'Invalid worker' });
  }

  const task = taskQueue.failTask(workerId, taskId, error);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const msg = `❌ *Task Failed*\n\n*Agent:* ${WORKERS[workerId].name}\n*Task:* ${task.description}\n*Error:* ${error}`;
  notifyDirector(msg);

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
app.post('/octavia/flow', (req, res) => {
  const { mode } = req.body;
  if (!mode || !['auto', 'manual'].includes(mode)) {
    return res.status(400).json({ error: 'Mode must be "auto" or "manual"' });
  }
  const newMode = taskQueue.setFlowControl(mode);
  res.json({ status: 'success', mode: newMode });
});

// Manager delegates a task to a worker
app.post('/octavia/delegate', async (req, res) => {
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
      const msg = `📋 *Task Delegated*\n\n*Manager:* Octavia → *Agent:* ${WORKERS[targetWorkerId].name}\n*Task:* ${delegated.description}\n*ID:* \`${delegated.id}\``;
      notifyDirector(msg);
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
app.post('/octavia/approve', (req, res) => {
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
app.post('/octavia/report', (req, res) => {
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
app.post('/octavia/message', (req, res) => {
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
app.post('/octavia/inbox/:messageId/read', (req, res) => {
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
app.post('/octavia/reports/:reportId/read', (req, res) => {
  const { reportId } = req.params;
  const report = taskQueue.managerFlowControl.agentReports.find(r => r.id === reportId);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  report.status = 'read';
  res.json({ status: 'success', report });
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
