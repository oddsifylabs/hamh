# HAMH | Hermes Agent Management Hub

> **You got them Hermes Agents, we got a Boss for them.**
>
> Open-source agent orchestration platform with enterprise commercial services.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)
[![GitHub Stars](https://img.shields.io/github/stars/oddsify-labs/hamh?style=flat-square)](https://github.com/oddsify-labs/hamh)
[![npm package](https://img.shields.io/npm/v/%40oddsify-labs/hamh.svg?style=flat-square)](https://www.npmjs.com/package/@oddsify-labs/hamh)

A production-ready, open-source **Hermes Agent Management Hub** — centralized command center for managing multiple AI agents with task orchestration, queuing, and real-time monitoring.

Built by **Oddsify Labs** — A Collins & Collins Technologies Company.

---

## 🎯 What is HAMH?

HAMH is the **boss** for your Hermes Agents. Whether you're running code agents (Miah Hermes), social bots (Markus Bot), market analyzers (Alexbet Sharp), or custom agents — HAMH manages them all from a single dashboard.

---

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn
- Linux/macOS (or Windows with WSL2)

### Installation

```bash
# Clone the repository
git clone https://github.com/oddsify-labs/hamh.git
cd hamh

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
nano .env  # Edit with your agent endpoints and API keys

# Start HAMH
npm start

# Visit the dashboard
open http://localhost:3000
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│         CEO Command Center Dashboard            │
│     (Frontend - HTML/CSS/JavaScript)            │
└────────────────────┬────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────┐
│      Manager Agent (Node.js/Express)            │
│  Task Orchestration & Command Routing           │
│              (VPS or Raspberry Pi)              │
└──────────┬───────────────────────┬──────────────┘
           │                       │
    ┌──────▼──────┐        ┌──────▼──────┐
    │   SSH       │        │   HTTP/HTTPS│
    │             │        │             │
    ▼             ▼        ▼             ▼
┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────┐
│  Miah   │  │ Legacy  │  │ Markus   │  │Alexbet │
│Hermes   │  │Systems  │  │  Bot     │  │ Sharp  │
│(VPS)    │  │(SSH)    │  │(HTTP)    │  │(Railway)
└─────────┘  └─────────┘  └──────────┘  └────────┘
```

---

## Usage

### Send Commands from Dashboard

```javascript
// Import the client
const client = new ManagerAgentClient('http://localhost:3000');

// Wait for connection
await client.connect();

// Send commands
await client.sendCommand('@miah deploy latest code');
await client.sendCommand('@markus post earnings update');
await client.sendCommand('@alexbet scan NFL markets');

// Status report
const status = await client.getStatus();

// Quick helpers
await client.deployCode();
await client.postToX('New earnings report released!');
await client.scanMarkets('NFL');
```

### API Endpoints

#### Command Execution
```
POST /command
Body: { "command": "@miah deploy code" }
Response: { status: 'success', task: {...}, result: {...} }
```

#### System Status
```
GET /status
Response: {
  timestamp: '...',
  workers: {
    miah: { name, status, queueLength, currentTask },
    markus: { name, status, queueLength, currentTask },
    alexbet: { name, status, queueLength, currentTask }
  },
  activityLog: [...]
}
```

#### Worker Queue
```
GET /queue/:workerId
Response: {
  workerId: 'miah',
  queue: [...],
  current: {...}
}
```

#### Activity Log
```
GET /activity?limit=50
Response: { log: [...] }
```

#### Legacy Integration
```
POST /legacy/task
Body: { "agentId": "coder", "action": "deploy", "params": {...} }

GET /legacy/status/:agentId
Response: { agentId, status, queueLength, tasks }
```

---

## Configuration

Edit `.env` to configure your agents:

```bash
# Server
PORT=3000
NODE_ENV=production

# Miah Hermes (VPS via SSH)
MIAH_HOST=your-vps-ip
MIAH_USER=root
MIAH_KEY_PATH=/home/manager/.ssh/miah_key

# Markus Bot (Local HTTP)
MARKUS_API=http://localhost:3001

# Alexbet Sharp (Railway HTTPS)
ALEXBET_API=https://alexbet-sharp.railway.app
ALEXBET_KEY=your-api-key

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/manager-agent.log
```

---

## Deployment

### Deploy to Hostinger VPS
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete step-by-step instructions.

Quick summary:
```bash
# SSH into VPS
ssh root@your-hostinger-ip

# Setup Node.js, install deps
apt update && apt install nodejs npm
cd /app/manager-agent && npm install

# Run with PM2
npm install -g pm2
pm2 start manager-agent-server.js
pm2 startup

# Setup Nginx reverse proxy & SSL
apt install nginx certbot
# ... configure nginx (see deployment guide)
```

### Deploy to Raspberry Pi
Same process as VPS, but on Raspberry Pi OS:
```bash
# Raspberry Pi setup
sudo apt update
sudo apt install nodejs npm
cd /home/pi/manager-agent
npm install
pm2 start manager-agent-server.js
```

---

## Pricing & Services

### Open Source (Free)
- Manager Agent source code (MIT License)
- Dashboard UI (MIT License)
- Community support via GitHub Issues

### Commercial Services (Paid)

#### 1. **Managed Manager Agent Hosting** — $49/month
- Hosted on Oddsify Labs secure VPS
- 99.9% uptime SLA
- Automatic backups
- Premium email support
- SSL/TLS included
- Monitoring & alerting

#### 2. **Raspberry Pi Hermes Agent Device** — $399 one-time
- Pre-configured Raspberry Pi 4 (4GB RAM)
- Pre-installed Manager Agent
- 12-month hardware warranty
- Setup & configuration included
- Lifetime free firmware updates
- Includes carrying case

#### 3. **Enterprise Setup & Integration** — Starting at $1,999
- Custom agent setup & configuration
- Legacy system integration
- Database setup (MongoDB/PostgreSQL)
- SSL certificate & domain setup
- Load balancing configuration
- Priority support (24/7 email, 4-hour response)

#### 4. **Custom Agent Development** — $150-300/hour
- Build custom agents tailored to your business
- Machine learning model integration
- Real-time data pipeline setup
- Performance optimization

#### 5. **Premium Support Plans**
- **Starter** — $199/month: Email support, 24hr response
- **Professional** — $499/month: Email + chat, 4hr response, monthly check-ins
- **Enterprise** — $1,999/month: 24/7 phone + chat, 1hr response, dedicated account manager

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork the repo
git clone https://github.com/your-username/agent-command-center.git
git checkout -b feature/my-feature

# Make changes, commit
git commit -am 'Add amazing feature'
git push origin feature/my-feature

# Open Pull Request
```

---

## License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) file.

**Commercial Use:** MIT License permits commercial use. Oddsify Labs reserves the right to offer premium hosting, support, and services built on this open-source software.

---

## Roadmap

- [ ] Web-based agent management UI
- [ ] Database persistence (MongoDB/PostgreSQL support)
- [ ] Kubernetes deployment templates
- [ ] REST API documentation (OpenAPI/Swagger)
- [ ] Python agent SDK
- [ ] Real-time WebSocket updates
- [ ] Agent health checks & auto-recovery
- [ ] Multi-tenant support for agencies
- [ ] Slack/Discord integration
- [ ] Webhook marketplace

---

## Support

### Free (Community)
- GitHub Issues for bugs and feature requests
- GitHub Discussions for questions
- Full source code access

### Commercial
- Email: support@oddsify-labs.com
- Phone: +1 (555) 123-4567
- Website: https://oddsify-labs.com

---

## Made by Oddsify Labs

**Oddsify Labs** — A Collins & Collins Technologies Company

- Website: https://oddsify-labs.com
- Email: hello@oddsify-labs.com
- Twitter: @OddsifyLabs
- LinkedIn: linkedin.com/company/oddsify-labs

---

## Disclaimer

This software is provided "AS IS" without warranty. Oddsify Labs is not responsible for damages caused by improper use, misconfiguration, or third-party integrations. For production use, we recommend the Managed Hosting service or enterprise support plan.
