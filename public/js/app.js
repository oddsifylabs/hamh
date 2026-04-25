/**
 * HAMH Dashboard Application
 * Hermes Agent Management Hub - Frontend
 * Oddsify Labs
 */

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  API_BASE: window.location.origin,
  POLL_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

// ============================================
// STATE
// ============================================
const state = {
  connected: false,
  reconnectAttempts: 0,
  currentView: 'dashboard',
  selectedAgent: null,
  workers: {},
  tasks: { queued: [], running: [], completed: [], failed: [] },
  activityLog: [],
  uptime: 0,
  pollTimer: null,
  taskFilter: 'all',
};

// Agent definitions (mirrors server config)
const AGENTS = {
  octavia: {
    id: 'octavia',
    name: 'Octavia Hermes',
    type: 'director-facing',
    transport: 'internal',
    icon: '🎛️',
    description: 'The Manager. The only agent that speaks with the Director (Jesse). Controls task flow between all agents. Writer/Admin/Researcher.',
    capabilities: ['task-orchestration', 'flow-control', 'agent-delegation', 'status-synthesis', 'director-reports', 'writing', 'research', 'admin'],
    templates: ['delegate to @miah', 'status report', 'pause all', 'approve task'],
    role: 'orchestrator',
    isManager: true,
  },
  miah: {
    id: 'miah',
    name: 'Miah Hermes',
    type: 'vps',
    transport: 'ssh',
    icon: '🧠',
    description: 'Software coder agent deployed on VPS',
    capabilities: ['write-code', 'deploy', 'debug', 'code-review', 'automation'],
    templates: ['deploy code', 'write feature', 'debug error', 'review PR'],
    reportsTo: 'octavia',
  },
  markus: {
    id: 'markus',
    name: 'Markus Bot',
    type: 'local',
    transport: 'http',
    icon: '📱',
    description: 'Social media manager running locally',
    capabilities: ['post-x', 'curate-content', 'engagement', 'analytics', 'schedule'],
    templates: ['post update', 'check engagement', 'schedule post', 'analytics report'],
    reportsTo: 'octavia',
  },
  alexbet: {
    id: 'alexbet',
    name: 'Alexbet Sharp',
    type: 'railway',
    transport: 'http',
    icon: '📊',
    description: 'Market scanner hosted on Railway',
    capabilities: ['scan-markets', 'kelly-sizing', 'edge-detection', 'alerts', 'pnl-tracking'],
    templates: ['scan markets', 'kelly sizing', 'edge detect', 'set alert'],
    reportsTo: 'octavia',
  },
};

// ============================================
// API CLIENT
// ============================================
const api = {
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE}${endpoint}`;
    const opts = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
    if (opts.body && typeof opts.body === 'object') {
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async health() {
    return this.request('/health');
  },

  async status() {
    return this.request('/status');
  },

  async sendCommand(command) {
    return this.request('/command', { method: 'POST', body: { command } });
  },

  async getQueue(workerId) {
    return this.request(`/queue/${workerId}`);
  },

  async getActivity(limit = 50) {
    return this.request(`/activity?limit=${limit}`);
  },

  async createLegacyTask(agentId, action, params = {}) {
    return this.request('/legacy/task', {
      method: 'POST',
      body: { agentId, action, params },
    });
  },

  // Manager endpoints
  async octaviaStatus() {
    return this.request('/octavia/status');
  },

  async octaviaFlow(mode) {
    return this.request('/octavia/flow', { method: 'POST', body: { mode } });
  },

  async octaviaDelegate(taskId, targetWorkerId, taskData) {
    return this.request('/octavia/delegate', {
      method: 'POST',
      body: { taskId, targetWorkerId, taskData }
    });
  },

  async octaviaApprove(taskId) {
    return this.request('/octavia/approve', { method: 'POST', body: { taskId } });
  },

  async octaviaInbox(status) {
    const qs = status ? `?status=${status}` : '';
    return this.request(`/octavia/inbox${qs}`);
  },

  async octaviaReports(agentId, status) {
    const params = new URLSearchParams();
    if (agentId) params.append('agentId', agentId);
    if (status) params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/octavia/reports${qs}`);
  },

  async octaviaInboxRead(messageId) {
    return this.request(`/octavia/inbox/${messageId}/read`, { method: 'POST' });
  },

  async octaviaReportsRead(reportId) {
    return this.request(`/octavia/reports/${reportId}/read`, { method: 'POST' });
  },
};

// ============================================
// UI HELPERS
// ============================================
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(message, type = 'info', duration = 4000) {
  const container = $('#toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-message">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d`;
}

// ============================================
// CONNECTION
// ============================================
async function checkConnection() {
  try {
    await api.health();
    if (!state.connected) {
      state.connected = true;
      state.reconnectAttempts = 0;
      updateConnectionStatus();
      showToast('Connected to HAMH server', 'success');
    }
  } catch (err) {
    if (state.connected) {
      state.connected = false;
      updateConnectionStatus();
      showToast('Disconnected from server', 'error');
    }
    state.reconnectAttempts++;
  }
}

function updateConnectionStatus() {
  const el = $('#connectionStatus');
  const dot = el.querySelector('.status-dot');
  const text = el.querySelector('.status-text');
  el.classList.remove('connected', 'disconnected');
  if (state.connected) {
    el.classList.add('connected');
    text.textContent = 'Connected';
  } else {
    el.classList.add('disconnected');
    text.textContent = 'Disconnected';
  }
}

// ============================================
// DATA SYNC
// ============================================
async function syncData() {
  try {
    const [statusData, activityData, octaviaData] = await Promise.all([
      api.status(),
      api.getActivity(30),
      api.octaviaStatus().catch(() => ({})),
    ]);

    // Update workers
    if (statusData.workers) {
      state.workers = statusData.workers;
    }

    // Update uptime
    if (statusData.uptime !== undefined) {
      state.uptime = statusData.uptime;
    }

    // Update activity
    if (activityData.log) {
      state.activityLog = activityData.log;
    }

    // Update octavia state from dedicated endpoint
    if (octaviaData.octavia) {
      state.octavia = octaviaData.octavia;
    } else if (statusData.octavia) {
      state.octavia = statusData.octavia;
    }

    // Build task lists from queues
    state.tasks.queued = [];
    state.tasks.running = [];
    state.tasks.completed = [];
    state.tasks.failed = [];

    Object.entries(statusData.workers || {}).forEach(([id, worker]) => {
      if (id === 'octavia') return; // skip octavia (manager)
      if (worker.queueLength > 0 && worker.currentTask) {
        state.tasks.queued.push({
          ...worker.currentTask,
          agentId: id,
          agentName: AGENTS[id]?.name || id,
        });
      }
    });

    // If server tracks completed/failed, we'd use those
    // For now, activity log drives completed count
    state.tasks.completed = state.activityLog
      .filter(a => a.message && a.message.includes('Completed'))
      .map(a => {
        const agentMatch = a.message.match(/\[([\w-]+)\]:/);
        return {
          description: a.message.replace(/✓ Completed \[[\w-]+\]: /, ''),
          agentId: agentMatch ? agentMatch[1] : null,
          status: 'completed',
          timestamp: a.timestamp,
        };
      });

    state.tasks.failed = state.activityLog
      .filter(a => a.message && a.message.includes('Failed'))
      .map(a => {
        const agentMatch = a.message.match(/\[([\w-]+)\]:/);
        return {
          description: a.message.replace(/✗ Failed \[[\w-]+\]: /, '').split(' - ')[0],
          agentId: agentMatch ? agentMatch[1] : null,
          status: 'failed',
          timestamp: a.timestamp,
        };
      });

    updateDashboard();
    updateAgentsView();
    if (state.selectedAgent) updateAgentDetail(state.selectedAgent);
    updateTasksView();
    updateManagerView();
  } catch (err) {
    console.error('Sync error:', err);
  }
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  syncData();
  state.pollTimer = setInterval(syncData, CONFIG.POLL_INTERVAL);
}

// ============================================
// VIEW ROUTING
// ============================================
function navigateTo(view, params = {}) {
  // Hide all views
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target view
  const target = $(`#view-${view}`);
  if (target) target.classList.add('active');

  // Update nav
  const navItem = $(`.nav-item[data-view="${view}"]`);
  if (navItem) navItem.classList.add('active');

  state.currentView = view;

  // Close mobile sidebar
  $('#sidebar').classList.remove('open');
  $('#sidebarOverlay').classList.remove('active');

  // Scroll to top
  $('.main-content').scrollTop = 0;
}

// ============================================
// DASHBOARD RENDER
// ============================================
function updateDashboard() {
  // Stats
  const activeAgents = Object.values(state.workers).filter(w => w.status === 'active').length;
  const totalQueued = Object.values(state.workers).reduce((sum, w) => sum + (w.queueLength || 0), 0);
  const completed = state.tasks.completed.length;

  $('#statAgents').textContent = activeAgents;
  $('#statTasks').textContent = totalQueued;
  $('#statCompleted').textContent = completed;
  $('#statUptime').textContent = formatDuration(state.uptime || 0);

  // Agent list
  const agentList = $('#dashboardAgentList');
  agentList.innerHTML = '';
  Object.entries(state.workers).forEach(([id, worker]) => {
    const agent = AGENTS[id];
    if (!agent) return;
    const row = document.createElement('div');
    row.className = 'agent-row';
    row.innerHTML = `
      <div class="agent-row-avatar">${agent.icon}</div>
      <div class="agent-row-info">
        <div class="agent-row-name">${agent.name}</div>
        <div class="agent-row-meta">${agent.type.toUpperCase()} · ${worker.queueLength || 0} queued</div>
      </div>
      <div class="agent-row-status">
        <span class="status-indicator ${worker.status || 'active'}"></span>
        <span>${worker.status === 'active' ? 'Online' : 'Offline'}</span>
      </div>
    `;
    row.addEventListener('click', () => {
      state.selectedAgent = id;
      navigateTo('agent-detail');
      updateAgentDetail(id);
    });
    agentList.appendChild(row);
  });

  if (agentList.children.length === 0) {
    agentList.innerHTML = '<div class="activity-empty">No agents configured</div>';
  }

  // Activity feed
  const feed = $('#activityFeed');
  feed.innerHTML = '';
  if (state.activityLog.length === 0) {
    feed.innerHTML = '<div class="activity-empty">No recent activity</div>';
  } else {
    state.activityLog.forEach(item => {
      const div = document.createElement('div');
      div.className = 'activity-item';
      let icon = 'ℹ️';
      let iconClass = 'info';
      if (item.message.includes('✓')) { icon = '✅'; iconClass = 'success'; }
      if (item.message.includes('✗')) { icon = '❌'; iconClass = 'error'; }
      div.innerHTML = `
        <div class="activity-icon ${iconClass}">${icon}</div>
        <div class="activity-content">
          <div class="activity-text">${item.message}</div>
          <div class="activity-time">${formatTime(item.timestamp)}</div>
        </div>
      `;
      feed.appendChild(div);
    });
  }

  // Update badges
  $('#taskCountBadge').textContent = totalQueued;
  $('#agentCountBadge').textContent = Object.keys(state.workers).length;

  // Update octavia badge with pending items
  const octaviaPending = (state.octavia?.pendingApprovals || 0) + (state.octavia?.agentReports || 0) + (state.octavia?.directorInbox || 0);
  $('#octaviaBadge').textContent = octaviaPending;
  $('#octaviaBadge').style.display = octaviaPending > 0 ? 'flex' : 'none';
}

// ============================================
// MANAGER VIEW
// ============================================
function updateManagerView() {
  if (!state.octavia) return;

  const m = state.octavia;

  // Stats
  $('#octaviaMode').textContent = m.mode === 'auto' ? 'Auto' : 'Manual';
  $('#octaviaQueueCount').textContent = m.queueLength || 0;
  $('#octaviaReportsCount').textContent = m.agentReports || 0;
  $('#octaviaInboxCount').textContent = m.directorInbox || 0;

  // Update sub-badges
  $('#octaviaQueueBadge').textContent = m.queueLength || 0;
  $('#octaviaReportsBadge').textContent = m.agentReports || 0;
  $('#octaviaInboxBadge').textContent = m.directorInbox || 0;

  // Flow status
  const flowStatus = $('#flowStatus');
  if (m.mode === 'auto') {
    flowStatus.innerHTML = 'Manager is in <strong>Auto</strong> mode. Tasks are delegated automatically.';
    $('#flowAuto').classList.add('active');
    $('#flowManual').classList.remove('active');
  } else {
    flowStatus.innerHTML = 'Manager is in <strong>Manual</strong> mode. You must approve each task before delegation.';
    $('#flowManual').classList.add('active');
    $('#flowAuto').classList.remove('active');
  }

  // Manager Queue
  const queueList = $('#octaviaQueueList');
  queueList.innerHTML = '';
  const managerWorker = state.workers?.octavia;
  if (managerWorker && managerWorker.queueLength > 0) {
    // We don't have the actual queue items from /status, just count
    // For now show a placeholder that updates when we have real data
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <div class="queue-item-title">${managerWorker.queueLength} task(s) awaiting Octavia</div>
      <div class="queue-item-meta">Mode: ${m.mode}</div>
    `;
    queueList.appendChild(item);
  } else {
    queueList.innerHTML = '<div class="queue-empty">No tasks in Octavia\'s queue</div>';
  }

  // Agent Reports
  const reportsList = $('#octaviaReportsList');
  reportsList.innerHTML = '';
  if (m.recentReports && m.recentReports.length > 0) {
    m.recentReports.forEach(report => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      const agent = AGENTS[report.agentId];
      item.innerHTML = `
        <div class="queue-item-title">${agent?.icon || '🤖'} ${report.summary || 'Report'}</div>
        <div class="queue-item-meta">${formatTime(report.timestamp)} · ${agent?.name || report.agentId}</div>
      `;
      reportsList.appendChild(item);
    });
  } else {
    reportsList.innerHTML = '<div class="queue-empty">No agent reports</div>';
  }

  // Managed Agents
  const managedList = $('#managedAgentsList');
  managedList.innerHTML = '';
  Object.entries(AGENTS).forEach(([id, agent]) => {
    if (id === 'octavia' || !agent.reportsTo) return;
    const worker = state.workers[id] || {};
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.innerHTML = `
      <div class="queue-item-title">${agent.icon} ${agent.name}</div>
      <div class="queue-item-meta">${agent.type.toUpperCase()} · ${worker.status === 'active' ? '🟢 Online' : '⛔ Offline'} · ${worker.queueLength || 0} queued</div>
    `;
    managedList.appendChild(item);
  });
  if (managedList.children.length === 0) {
    managedList.innerHTML = '<div class="queue-empty">No agents configured</div>';
  }

  // Director Inbox
  const inboxList = $('#directorInboxList');
  inboxList.innerHTML = '';
  if (m.directorMessages && m.directorMessages.length > 0) {
    m.directorMessages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.innerHTML = `
        <div class="queue-item-title">${msg.status === 'unread' ? '🔴 ' : ''}${msg.message}</div>
        <div class="queue-item-meta">${formatTime(msg.timestamp)}</div>
      `;
      inboxList.appendChild(item);
    });
  } else {
    inboxList.innerHTML = '<div class="queue-empty">No messages from Octavia</div>';
  }
}

async function sendDirectorCommand() {
  const input = $('#directorCommandInput');
  const command = input.value.trim();
  if (!command) return;

  input.value = '';
  showToast('Sending to Octavia...', 'info');

  try {
    const result = await api.sendCommand(command);
    showToast(`Octavia: ${result.flow || 'Task received'}`, 'success');
    syncData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function setOctaviaFlow(mode) {
  try {
    await api.octaviaFlow(mode);
    showToast(`Octavia flow set to ${mode}`, 'success');
    syncData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================
// AGENTS VIEW
// ============================================
function updateAgentsView() {
  const grid = $('#agentsGrid');
  grid.innerHTML = '';

  Object.entries(AGENTS).forEach(([id, agent]) => {
    const worker = state.workers[id] || {};
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.innerHTML = `
      <div class="agent-card-header">
        <div class="agent-card-avatar">${agent.icon}</div>
        <div class="agent-card-title">
          <div class="agent-card-name">${agent.name}</div>
          <span class="agent-card-type ${agent.type}">${agent.type}</span>
        </div>
      </div>
      <div class="agent-card-body">
        <div class="agent-card-stat">
          <span class="agent-card-stat-label">Status</span>
          <span class="agent-card-stat-value">${worker.status === 'active' ? '🟢 Online' : '⛔ Offline'}</span>
        </div>
        <div class="agent-card-stat">
          <span class="agent-card-stat-label">Queue</span>
          <span class="agent-card-stat-value">${worker.queueLength || 0} tasks</span>
        </div>
        <div class="agent-card-stat">
          <span class="agent-card-stat-label">Transport</span>
          <span class="agent-card-stat-value">${agent.transport.toUpperCase()}</span>
        </div>
      </div>
      <div class="agent-card-footer">
        <button class="agent-card-btn" data-agent="${id}" data-action="command">Send Command</button>
        <button class="agent-card-btn" data-agent="${id}" data-action="queue">View Queue</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.agent-card-btn')) return;
      state.selectedAgent = id;
      navigateTo('agent-detail');
      updateAgentDetail(id);
    });
    grid.appendChild(card);
  });

  // Button handlers
  $$('.agent-card-btn[data-action="command"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.agent;
      state.selectedAgent = agentId;
      navigateTo('agent-detail');
      updateAgentDetail(agentId);
      setTimeout(() => $('#agentCommandInput').focus(), 100);
    });
  });

  $$('.agent-card-btn[data-action="queue"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const agentId = btn.dataset.agent;
      state.selectedAgent = agentId;
      navigateTo('agent-detail');
      updateAgentDetail(agentId);
    });
  });
}

// ============================================
// AGENT DETAIL VIEW
// ============================================
async function updateAgentDetail(agentId) {
  const agent = AGENTS[agentId];
  const worker = state.workers[agentId] || {};
  if (!agent) return;

  $('#agentDetailName').textContent = agent.name;
  $('#agentDetailSubtitle').textContent = agent.description;
  $('#agentDetailStatus').textContent = worker.status === 'active' ? 'Active' : 'Offline';
  $('#agentDetailStatus').style.background = worker.status === 'active' ? 'var(--success-soft)' : 'var(--danger-soft)';
  $('#agentDetailStatus').style.color = worker.status === 'active' ? 'var(--success)' : 'var(--danger)';
  $('#agentDetailType').textContent = agent.type.toUpperCase();
  $('#agentDetailTransport').textContent = agent.transport.toUpperCase();
  $('#agentDetailQueue').textContent = worker.queueLength || 0;
  $('#agentDetailEndpoint').textContent = worker.host || worker.baseUrl || 'Local';

  // Capabilities
  const capList = $('#agentDetailCapabilities');
  capList.innerHTML = '';
  agent.capabilities.forEach(cap => {
    const tag = document.createElement('span');
    tag.className = 'capability-tag';
    tag.textContent = cap;
    capList.appendChild(tag);
  });

  // Command templates
  const templates = $('#agentCommandTemplates');
  templates.innerHTML = '';
  agent.templates.forEach(tpl => {
    const chip = document.createElement('span');
    chip.className = 'template-chip';
    chip.textContent = tpl;
    chip.addEventListener('click', () => {
      $('#agentCommandInput').value = tpl;
    });
    templates.appendChild(chip);
  });

  // Task queue
  const queueList = $('#agentTaskQueue');
  queueList.innerHTML = '';

  try {
    const queueData = await api.getQueue(agentId);
    if (queueData.queue && queueData.queue.length > 0) {
      queueData.queue.forEach(task => {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.innerHTML = `
          <div class="queue-item-title">${task.description || 'Untitled task'}</div>
          <div class="queue-item-meta">${task.type || 'custom'} · ${formatTime(task.createdAt)}</div>
        `;
        queueList.appendChild(item);
      });
    } else {
      queueList.innerHTML = '<div class="queue-empty">No tasks in queue</div>';
    }
  } catch (err) {
    queueList.innerHTML = '<div class="queue-empty">Could not load queue</div>';
  }
}

// ============================================
// TASKS VIEW
// ============================================
function updateTasksView() {
  const columns = {
    queued: $('#tasksQueued'),
    running: $('#tasksRunning'),
    completed: $('#tasksCompleted'),
    failed: $('#tasksFailed'),
  };

  const counts = {
    queued: $('#countQueued'),
    running: $('#countRunning'),
    completed: $('#countCompleted'),
    failed: $('#countFailed'),
  };

  // Clear columns
  Object.values(columns).forEach(c => c.innerHTML = '');

  // Filter function
  const filterFn = (task) => {
    if (state.taskFilter === 'all') return true;
    return task.status === state.taskFilter;
  };

  // Render tasks into columns
  Object.entries(state.tasks).forEach(([status, tasks]) => {
    const filtered = tasks.filter(filterFn);
    counts[status].textContent = filtered.length;

    if (filtered.length === 0) {
      columns[status].innerHTML = '<div class="queue-empty">No tasks</div>';
    } else {
      filtered.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        const agent = AGENTS[task.agentId];
        card.innerHTML = `
          <div class="task-card-title">${task.description || 'Untitled'}</div>
          <div class="task-card-meta">
            <span class="task-card-agent">${agent ? agent.name : task.agentId || 'Unknown'}</span>
            <span class="task-card-time">${formatTime(task.timestamp || task.createdAt)}</span>
          </div>
        `;
        columns[status].appendChild(card);
      });
    }
  });
}

// ============================================
// SETTINGS VIEW
// ============================================
function updateSettingsView() {
  const list = $('#settingsAgentList');
  list.innerHTML = '';

  Object.entries(AGENTS).forEach(([id, agent]) => {
    const worker = state.workers[id] || {};
    const item = document.createElement('div');
    item.className = 'setting-item';
    item.innerHTML = `
      <label>${agent.name}</label>
      <span class="setting-value">${worker.status === 'active' ? '🟢 Online' : '⛔ Offline'}</span>
    `;
    list.appendChild(item);
  });

  $('#settingsUptime').textContent = formatDuration(state.uptime || 0);
}

// ============================================
// COMMAND HANDLING
// ============================================
async function sendCommand(command, source = 'global') {
  if (!command.trim()) return;

  const input = source === 'global' ? $('#commandInput') : $('#agentCommandInput');
  const originalValue = input.value;
  input.disabled = true;

  try {
    showToast(`Sending: ${command}`, 'info');
    const result = await api.sendCommand(command);
    showToast(result.status === 'success' ? 'Command executed' : 'Command failed', result.status === 'success' ? 'success' : 'error');
    input.value = '';
    syncData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ============================================
// EVENT LISTENERS
// ============================================
function initEventListeners() {
  // Navigation
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      navigateTo(view);
      if (view === 'settings') updateSettingsView();
    });
  });

  // Mobile menu
  $('#mobileMenuToggle').addEventListener('click', () => {
    $('#sidebar').classList.toggle('open');
    $('#sidebarOverlay').classList.toggle('active');
  });

  $('#sidebarOverlay').addEventListener('click', () => {
    $('#sidebar').classList.remove('open');
    $('#sidebarOverlay').classList.remove('active');
  });

  // Command input
  $('#commandInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendCommand(e.target.value, 'global');
  });

  $('#commandSend').addEventListener('click', () => {
    sendCommand($('#commandInput').value, 'global');
  });

  // Director command input (Manager view)
  $('#directorCommandInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendDirectorCommand();
  });

  $('#directorCommandSend').addEventListener('click', () => {
    sendDirectorCommand();
  });

  // Flow control buttons
  $('#flowAuto').addEventListener('click', () => setOctaviaFlow('auto'));
  $('#flowManual').addEventListener('click', () => setOctaviaFlow('manual'));

  // Command hints
  $$('.hint').forEach(hint => {
    hint.addEventListener('click', () => {
      $('#commandInput').value = hint.textContent;
      $('#commandInput').focus();
    });
  });

  // Quick actions
  $$('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sendCommand(btn.dataset.cmd, 'global');
    });
  });

  // Agent detail command
  $('#agentCommandSend').addEventListener('click', () => {
    const input = $('#agentCommandInput');
    const cmd = state.selectedAgent ? `@${state.selectedAgent} ${input.value}` : input.value;
    sendCommand(cmd, 'agent');
  });

  $('#agentCommandInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const input = $('#agentCommandInput');
      const cmd = state.selectedAgent ? `@${state.selectedAgent} ${input.value}` : input.value;
      sendCommand(cmd, 'agent');
    }
  });

  // Back button
  $('#backToAgents').addEventListener('click', () => {
    state.selectedAgent = null;
    navigateTo('agents');
  });

  // Refresh activity
  $('#refreshActivity').addEventListener('click', () => {
    syncData();
    showToast('Activity refreshed', 'success');
  });

  // Task filters
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.taskFilter = btn.dataset.filter;
      updateTasksView();
    });
  });

  // Create task modal
  $('#createTaskBtn').addEventListener('click', () => {
    $('#createTaskModal').classList.add('active');
  });

  $$('.modal-close, .modal-cancel, .modal-backdrop').forEach(el => {
    el.addEventListener('click', () => {
      $('#createTaskModal').classList.remove('active');
    });
  });

  $('#taskCreateConfirm').addEventListener('click', async () => {
    const agentId = $('#taskAgentSelect').value;
    const desc = $('#taskDescriptionInput').value;
    const type = $('#taskTypeSelect').value;

    if (!desc.trim()) {
      showToast('Please enter a description', 'error');
      return;
    }

    const command = `@${agentId} ${type !== 'custom' ? type : ''} ${desc}`.trim();
    $('#createTaskModal').classList.remove('active');
    await sendCommand(command, 'global');
    $('#taskDescriptionInput').value = '';
  });

  // Theme toggle
  $$('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.setAttribute('data-theme', btn.dataset.theme);
      localStorage.setItem('hamh-theme', btn.dataset.theme);
    });
  });

  // Compact mode
  $('#compactModeToggle').addEventListener('change', (e) => {
    document.body.setAttribute('data-compact', e.target.checked);
    localStorage.setItem('hamh-compact', e.target.checked);
  });

  // Settings inputs
  $('#settingsPollInterval').addEventListener('change', (e) => {
    CONFIG.POLL_INTERVAL = parseInt(e.target.value, 10);
    localStorage.setItem('hamh-pollInterval', CONFIG.POLL_INTERVAL);
    startPolling();
  });

  $('#settingsApiUrl').addEventListener('change', (e) => {
    CONFIG.API_BASE = e.target.value;
    localStorage.setItem('hamh-apiUrl', CONFIG.API_BASE);
  });

  // Clear activity
  $('#clearActivityBtn').addEventListener('click', () => {
    state.activityLog = [];
    showToast('Activity log cleared', 'info');
    updateDashboard();
  });
}

// ============================================
// LOCAL STORAGE
// ============================================
function loadSettings() {
  const theme = localStorage.getItem('hamh-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  $$(`.theme-btn[data-theme="${theme}"]`).forEach(b => b.classList.add('active'));
  $$(`.theme-btn:not([data-theme="${theme}"])`).forEach(b => b.classList.remove('active'));

  const compact = localStorage.getItem('hamh-compact') === 'true';
  document.body.setAttribute('data-compact', compact);
  $('#compactModeToggle').checked = compact;

  const pollInterval = parseInt(localStorage.getItem('hamh-pollInterval'), 10);
  if (pollInterval) {
    CONFIG.POLL_INTERVAL = pollInterval;
    $('#settingsPollInterval').value = pollInterval;
  }

  const apiUrl = localStorage.getItem('hamh-apiUrl');
  if (apiUrl) {
    CONFIG.API_BASE = apiUrl;
    $('#settingsApiUrl').value = apiUrl;
  }
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initEventListeners();
  checkConnection().then(() => {
    startPolling();
  });

  // Handle hash-based routing
  const hash = window.location.hash.slice(1);
  if (hash && $(`#view-${hash}`)) {
    navigateTo(hash);
  }

  window.addEventListener('hashchange', () => {
    const view = window.location.hash.slice(1);
    if (view && $(`#view-${view}`)) {
      navigateTo(view);
    }
  });
});
