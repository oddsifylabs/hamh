# Miah Hermes - Software Coder Worker

Oddsify Labs Software Coder. Runs on Hostinger VPS and polls HAMH for coding/deployment tasks.

## Setup

```bash
cd /home/miah/miah-worker
npm install
npm start
```

## systemd Service

```bash
sudo cp miah-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable miah-worker
sudo systemctl start miah-worker
```

## Task Types

| Type | Description |
|---|---|
| `write-code` | Generate or write code |
| `deploy` | Deploy to servers |
| `debug` | Debug issues |
| `code-review` | Review code/PRs |
| `automation` | Run automation scripts |
