# Worker Deployment Guide

All 4 workers poll HAMH on Railway. Here's how to deploy each.

---

## Markus (Mint Linux - Home Computer)

```bash
# Copy workers/markus/ folder to Markus's Mint machine
cd /home/markus/markus-worker
npm install

# Test
npm start

# Install as service
sudo cp markus-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable markus-worker
sudo systemctl start markus-worker
sudo journalctl -u markus-worker -f
```

---

## Miah (Hostinger VPS)

```bash
# Copy workers/miah/ folder to Miah's VPS
cd /home/miah/miah-worker
npm install

# Test
npm start

# Install as service
sudo cp miah-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable miah-worker
sudo systemctl start miah-worker
```

---

## Mitch (Railway)

Option A: **Separate Railway service**
- Create new Railway service from `workers/mitch/`
- Set `HAMH_BASE_URL=https://hamh.oddsifylabs.com`
- Deploy

Option B: **Run alongside HAMH** (same project)
- Add `workers/mitch/` as additional service in existing HAMH project

---

## Ruth (Railway)

Same as Mitch:
- Create new Railway service from `workers/ruth/`
- Or run alongside HAMH in same project

---

## How to Task Any Worker

From HAMH dashboard, Telegram, or API:

```
@markus post-x New product launch tomorrow
@miah deploy oddsifylabs.com
@mitch lead-gen Find AI agencies in Arizona
@ruth build Landing page for ebook store
```

---

## Worker Status Check

```bash
curl https://hamh.oddsifylabs.com/status
```

Returns queue lengths and current tasks for all workers.
