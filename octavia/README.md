# Octavia Hermes - Manager Agent Telegram Interface

Octavia is the bridge between Jesse (Director) and the worker fleet. She runs as a Telegram bot, receives commands via DM, and forwards `@mention` tasks to HAMH.

## What She Does

1. **Receives your Telegram DMs**
2. **Detects `@markus`, `@miah`, `@mitch`, `@ruth`** → forwards to HAMH `/command`
3. **Handles shortcuts:** `status report`, `pause all`, `resume all`
4. **Replies with confirmation** from HAMH

## Deploy to Railway (under HAMH project)

```bash
# 1. In Railway dashboard, create new service from GitHub repo
#    Point to oddsifylabs/hamh, directory: /octavia

# 2. Set environment variables in Railway:
TELEGRAM_BOT_TOKEN=8560490088:AAFaK5lin7ycVvB1NNxABatB7FrwTmkN50A
JESSE_CHAT_ID=8502906149
HAMH_BASE_URL=http://hamh.railway.internal:3000
POLL_INTERVAL_MS=3000

# 3. Deploy
# Railway will auto-build from package.json
```

## Important: Stop Old Octavia First

Before deploying this new Octavia, **stop or delete** the old Octavia service (`hermes-agent-production-4a66`) so there's no Telegram token conflict.

## Architecture

```
You ──DM──► @OctaviaHermesBot (this service)
              │
              ├── @markus post-x hello ──► HAMH /command
              │                                │
              │                                ▼
              │                         Queues for Markus
              │                                │
              │                                ▼
              │                         Worker polls + executes
              │                                │
              └──◄──────────── HAMH notifies you via Telegram
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | Octavia's bot token |
| `JESSE_CHAT_ID` | Yes | Your Telegram user ID |
| `HAMH_BASE_URL` | Yes | HAMH URL (private or public) |
| `POLL_INTERVAL_MS` | No | Telegram poll interval (default: 3000ms) |
