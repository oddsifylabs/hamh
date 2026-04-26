# HAMH Railway Redeployment Checklist
## Step-by-Step (No Guessing)

---

## STEP 1: Log into Railway
1. Go to https://railway.app/dashboard
2. Open your HAMH project

---

## STEP 2: Reconfigure HAMH Service (The Main Server)

1. **Click the HAMH service** (the main Node.js app)
2. **Click the "Variables" tab**
3. **ADD this new variable:**
   ```
   API_KEY = <generate a strong random key>
   ```
   To generate: run `openssl rand -hex 32` in your terminal, or use any password generator
4. **DELETE these old variables** (if they exist):
   - `TELEGRAM_BOT_TOKEN`
   - `JESSE_CHAT_ID`
5. **Click "Deploy"** on the HAMH service (or it may auto-deploy)
6. **Wait for it to finish** (green checkmark)

---

## STEP 3: Delete the Old Octavia Service

1. **Find the old Octavia service** in your Railway project
   - It probably has a name like "octavia" or an old domain like `hermes-agent-production-4a66.up.railway.app`
2. **Click it**
3. **Go to Settings tab**
4. **Scroll to bottom** → click **"Delete Service"**
5. **Confirm deletion**

---

## STEP 4: Deploy New Octavia Daemon

1. In Railway, click **"New"** → **"Service"** → **"Deploy from GitHub repo"**
2. Select: **`oddsifylabs/hamh`**
3. **IMPORTANT:** Change the **Root Directory** from `/` to **`octavia/`**
4. Click **"Add Service"**
5. **Click the new Octavia service** → **"Variables" tab**
6. **Add these variables:**
   ```
   HAMH_BASE_URL = http://hamh.railway.internal:3000
   API_KEY = <SAME KEY AS STEP 2>
   ```
7. **Click "Deploy"**
8. **Wait for green checkmark**

---

## STEP 5: Deploy Nova Worker

1. Click **"New"** → **"Service"** → **"Deploy from GitHub repo"**
2. Select: **`oddsifylabs/hamh`**
3. **Change Root Directory** to **`nova-worker/`**
4. Click **"Add Service"**
5. **Click the new Nova service** → **"Variables" tab**
6. **Add these variables:**
   ```
   HAMH_BASE_URL = http://hamh.railway.internal:3000
   API_KEY = <SAME KEY AS STEP 2>
   ```
7. **Click "Deploy"**
8. **Wait for green checkmark**

---

## STEP 6: Update Mitch & Ruth Workers

1. **Click the Mitch service** → **"Variables" tab**
2. **Find `HAMH_BASE_URL`**
3. **Change it to:** `http://hamh.railway.internal:3000`
4. **Add `API_KEY`** = same key from Step 2
5. **Redeploy Mitch**
6. **Repeat Steps 1-5 for the Ruth service**

---

## STEP 7: Verify Everything Works

1. **Open your HAMH URL:** `https://hamh.oddsifylabs.com`
2. **Check the dashboard loads**
3. **Test from your local CLI:**
   ```bash
   hamh config --set url https://hamh.oddsifylabs.com
   hamh config --set key <YOUR_API_KEY>
   hamh status
   hamh health
   ```

---

## What Should Be Running When Done

| Service | Source | Status |
|---------|--------|--------|
| HAMH (main server) | `src/` | ✅ Active |
| Octavia Daemon | `octavia/` | ✅ Polling HAMH |
| Nova Worker | `nova-worker/` | ✅ Polling HAMH |
| Mitch Worker | `mitch-worker/` | ✅ Polling HAMH |
| Ruth Worker | `ruth-worker/` | ✅ Polling HAMH |
| Markus Worker | External (Mint) | ✅ Polling HAMH |
| Miah Worker | External (VPS) | ✅ Polling HAMH |

---

## If Something Breaks

**Dashboard won't load?**
- Check Railway logs for HAMH service
- Make sure `API_KEY` is set

**Octavia won't connect?**
- Check that `HAMH_BASE_URL` is exactly: `http://hamh.railway.internal:3000`
- Check Railway logs for Octavia service

**Workers show offline?**
- Make sure all workers have the SAME `API_KEY`
- Check individual worker logs in Railway

---

## Copy This API Key Everywhere

Generate ONE key in Step 2. Use that EXACT SAME key for:
- HAMH service
- Octavia daemon
- Nova worker
- Mitch worker
- Ruth worker

**Do NOT use different keys.**
