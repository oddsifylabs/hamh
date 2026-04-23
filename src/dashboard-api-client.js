/**
 * DASHBOARD API CLIENT
 * Connects frontend CEO Command Center to Manager Agent backend
 */

class ManagerAgentClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Initialize connection to Manager Agent
   */
  async connect() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      if (response.ok) {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('✓ Connected to Manager Agent');
        return true;
      }
    } catch (error) {
      console.error('✗ Failed to connect to Manager Agent:', error);
      this.isConnected = false;
      this.reconnectAttempts++;

      // Retry with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = Math.pow(2, this.reconnectAttempts) * 1000;
        setTimeout(() => this.connect(), delay);
      }
    }
    return false;
  }

  /**
   * Send command from CEO dashboard
   * Examples:
   * - "@miah deploy code"
   * - "@markus post earnings update"
   * - "@alexbet scan NFL markets"
   * - "status report"
   */
  async sendCommand(command) {
    if (!this.isConnected) {
      throw new Error('Not connected to Manager Agent');
    }

    try {
      const response = await fetch(`${this.baseUrl}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Command failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Command failed:', error);
      throw error;
    }
  }

  /**
   * Get current system status (all workers, queues, current tasks)
   */
  async getStatus() {
    if (!this.isConnected) {
      throw new Error('Not connected to Manager Agent');
    }

    try {
      const response = await fetch(`${this.baseUrl}/status`);
      if (!response.ok) throw new Error('Failed to fetch status');
      return await response.json();
    } catch (error) {
      console.error('Status fetch failed:', error);
      throw error;
    }
  }

  /**
   * Get queue for specific worker
   */
  async getWorkerQueue(workerId) {
    if (!this.isConnected) {
      throw new Error('Not connected to Manager Agent');
    }

    try {
      const response = await fetch(`${this.baseUrl}/queue/${workerId}`);
      if (!response.ok) throw new Error('Failed to fetch queue');
      return await response.json();
    } catch (error) {
      console.error(`Queue fetch failed for ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Get activity log
   */
  async getActivityLog(limit = 50) {
    if (!this.isConnected) {
      throw new Error('Not connected to Manager Agent');
    }

    try {
      const response = await fetch(`${this.baseUrl}/activity?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch activity log');
      return await response.json();
    } catch (error) {
      console.error('Activity log fetch failed:', error);
      throw error;
    }
  }

  /**
   * Start polling for real-time updates
   */
  startPolling(interval = 3000, callback) {
    this.pollingInterval = setInterval(async () => {
      try {
        const status = await this.getStatus();
        const activity = await this.getActivityLog(20);
        callback({ status, activity });
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, interval);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Quick command helpers
   */
  async deployCode() {
    return this.sendCommand('@miah deploy latest code');
  }

  async postToX(content) {
    return this.sendCommand(`@markus post to X: ${content}`);
  }

  async scanMarkets(markets) {
    return this.sendCommand(`@alexbet scan ${markets || 'all'} markets`);
  }

  async getStatusReport() {
    return this.sendCommand('status report');
  }

  async pauseAllAgents() {
    return this.sendCommand('pause all');
  }

  async resumeAllAgents() {
    return this.sendCommand('resume all');
  }
}

// Initialize global client
const managerAgent = new ManagerAgentClient(
  window.MANAGER_AGENT_URL || 'http://localhost:3000'
);

// Auto-connect on load
document.addEventListener('DOMContentLoaded', () => {
  managerAgent.connect();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ManagerAgentClient;
}
