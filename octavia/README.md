# Octavia Daemon

Octavia Hermes - Autonomous Manager Agent for HAMH.

No Telegram. No chat interface. Pure autonomous daemon.

## What Octavia Does

- **Polls HAMH** for tasks in the `octavia` queue
- **Auto-delegates** Director commands to workers (`@miah`, `@markus`, `@mitch`, `@ruth`)
- **Flow control** handles `pause all` / `resume all`
- **Status reports** on demand or on schedule
- **Health checks** HAMH every 60s
- **Auto-reports** fleet status to Director inbox every hour
- **Escalates** blockers and failures to Director inbox

## Environment Variables

```bash
HAMH_BASE_URL=http://hamh.railway.internal:3000   # Internal URL when in same Railway project
API_KEY=your_api_key_here                         # Same API key as HAMH
POLL_INTERVAL_MS=5000                             # How often to check for tasks
HEALTH_CHECK_INTERVAL_MS=60000                    # HAMH health check frequency
AUTO_REPORT_INTERVAL_MS=3600000                   # Hourly auto-report
```

## Deployment

### Railway (same project as HAMH)

1. Add as a new service in the same Railway project
2. Set `HAMH_BASE_URL=http://hamh.railway.internal:3000`
3. Set `API_KEY` to match HAMH's API_KEY
4. Deploy

### Local / VPS

```bash
cd octavia
npm install
HAMH_BASE_URL=http://localhost:3000 API_KEY=xxx node octavia-daemon.js
```

## Running as a Systemd Service

```ini
[Unit]
Description=Octavia Daemon
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/octavia
ExecStart=/usr/bin/node octavia-daemon.js
Restart=always
RestartSec=10
Environment=HAMH_BASE_URL=http://localhost:3000
Environment=API_KEY=your_key_here

[Install]
WantedBy=multi-user.target
```
