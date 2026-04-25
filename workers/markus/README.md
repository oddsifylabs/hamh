# Markus Hermes - Worker Client

Oddsify Labs Social Media Manager. Runs on Markus's Mint Linux box and polls HAMH (Hermes Agent Management Hub) for tasks.

## Setup

```bash
# 1. Clone or copy this folder to Markus's Mint Linux box
cd /home/markus/markus-worker

# 2. Install dependencies
npm install

# 3. Copy env file
cp .env.example .env

# 4. Edit .env if needed (defaults point to production HAMH)
nano .env

# 5. Start the worker
npm start
```

## Running as a Service (systemd)

Create `/etc/systemd/system/markus-worker.service`:

```ini
[Unit]
Description=Markus Hermes Worker
After=network.target

[Service]
Type=simple
User=markus
WorkingDirectory=/home/markus/markus-worker
ExecStart=/usr/bin/node markus-worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable markus-worker
sudo systemctl start markus-worker
sudo systemctl status markus-worker
```

## Task Types Handled

| Type | Description | Status |
|---|---|---|
| `post-x` | Post to X/Twitter | Stub — implement actual X API |
| `engagement` | Reply, like, retweet, follow | Stub — implement |
| `analytics` | Fetch stats, generate reports | Stub — implement |
| `curate-content` | Find trending topics, gather links | Stub — implement |
| `schedule` | Schedule future posts | Stub — implement |

## Architecture

```
Markus (Mint Linux)
  ↓ every 30s
GET https://hamh.oddsifylabs.com/api/tasks/poll?agent=markus
  ↓ if task
Execute handler
  ↓
POST https://hamh.oddsifylabs.com/api/tasks/{id}/complete
  ↓
Jesse gets Telegram notification
```

## Logs

```bash
# If running via systemd
sudo journalctl -u markus-worker -f

# If running manually
npm start
```
