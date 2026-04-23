# MANAGER AGENT DEPLOYMENT GUIDE
# Oddsify Labs - Hostinger VPS Setup

## Prerequisites
- Hostinger VPS account
- SSH access to VPS
- Node.js 16+ installed
- SSH keys for connecting to Miah Hermes VPS
- Basic Linux/bash knowledge

---

## STEP 1: Initial VPS Setup

### 1.1 SSH into your Hostinger VPS
```bash
ssh root@your-hostinger-ip-address
```

### 1.2 Update system
```bash
apt update && apt upgrade -y
```

### 1.3 Install Node.js and npm
```bash
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
node --version  # Should be v18+
npm --version
```

### 1.4 Install additional tools
```bash
apt install -y git curl wget nano supervisor
```

---

## STEP 2: Clone/Setup Manager Agent

### 2.1 Create app directory
```bash
mkdir -p /app/manager-agent
cd /app/manager-agent
```

### 2.2 Copy files to VPS
Option A: Using git (if you push to a repo):
```bash
git clone https://github.com/your-org/manager-agent.git .
```

Option B: Using scp from your local machine:
```bash
scp package.json root@your-hostinger-ip:/app/manager-agent/
scp manager-agent-server.js root@your-hostinger-ip:/app/manager-agent/
scp .env.example root@your-hostinger-ip:/app/manager-agent/
```

### 2.3 Install dependencies
```bash
cd /app/manager-agent
npm install
```

### 2.4 Create .env file
```bash
cp .env.example .env
nano .env
```

Edit with your actual values:
```
PORT=3000
NODE_ENV=production

# Miah Hermes
MIAH_HOST=your-miah-vps-ip
MIAH_USER=root
MIAH_KEY_PATH=/root/.ssh/miah_key

# Markus Bot
MARKUS_API=http://192.168.1.100:3001  # Local network IP

# Alexbet Sharp
ALEXBET_API=https://alexbet-sharp.railway.app
ALEXBET_KEY=your-railway-api-key
```

Save with Ctrl+X, Y, Enter

---

## STEP 3: Setup SSH Keys (for Miah Hermes connection)

### 3.1 Create SSH key directory
```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
```

### 3.2 Add Miah Hermes SSH key
Copy your private key to the VPS:
```bash
# From your local machine
scp ~/.ssh/miah_key root@your-hostinger-ip:/root/.ssh/miah_key
```

Then on the VPS:
```bash
chmod 600 /root/.ssh/miah_key
```

### 3.3 Test SSH connection to Miah
```bash
ssh -i /root/.ssh/miah_key root@miah-vps-ip "echo 'SSH working!'"
```

---

## STEP 4: Run Manager Agent

### 4.1 Test locally first
```bash
cd /app/manager-agent
npm start
```

You should see:
```
╔════════════════════════════════════════╗
║  MANAGER AGENT SERVER                  ║
║  Oddsify Labs - CEO Command Center    ║
║  Running on port 3000                  ║
╚════════════════════════════════════════╝
```

Test health endpoint:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","uptime":...}
```

Press Ctrl+C to stop

### 4.2 Setup PM2 (process manager for production)
```bash
npm install -g pm2
pm2 start manager-agent-server.js --name "manager-agent"
pm2 save
pm2 startup
```

Verify it's running:
```bash
pm2 status
```

---

## STEP 5: Setup Reverse Proxy (Nginx)

### 5.1 Install Nginx
```bash
apt install -y nginx
```

### 5.2 Create Nginx config
```bash
nano /etc/nginx/sites-available/manager-agent
```

Paste this:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # CORS headers
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;

    if ($request_method = 'OPTIONS') {
        return 204;
    }
}
```

### 5.3 Enable the site
```bash
ln -s /etc/nginx/sites-available/manager-agent /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

---

## STEP 6: SSL Certificate (Let's Encrypt)

### 6.1 Install Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 6.2 Get certificate
```bash
certbot --nginx -d your-domain.com
```

Follow the prompts. Certbot will automatically update your Nginx config.

### 6.3 Auto-renewal
```bash
systemctl enable certbot.timer
systemctl start certbot.timer
```

---

## STEP 7: Firewall Setup

### 7.1 Enable UFW (firewall)
```bash
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

---

## STEP 8: Connect Dashboard

In your dashboard HTML, set:
```html
<script>
  window.MANAGER_AGENT_URL = 'https://your-domain.com';
</script>
<script src="dashboard-api-client.js"></script>
```

---

## MONITORING & LOGS

### View Manager Agent logs
```bash
pm2 logs manager-agent
```

### Monitor system resources
```bash
pm2 monit
```

### Nginx logs
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## TROUBLESHOOTING

### Manager Agent won't start
```bash
pm2 logs manager-agent --err
```

### Can't connect to Miah
```bash
ssh -i /root/.ssh/miah_key root@miah-vps-ip
```

### Nginx 502 Bad Gateway
- Check if Node.js is running: `pm2 status`
- Check firewall: `ufw status`
- Check Nginx config: `nginx -t`

### CORS errors in dashboard
Make sure Nginx config has:
```nginx
add_header 'Access-Control-Allow-Origin' '*' always;
```

---

## SECURITY CHECKLIST

- [ ] SSH keys protected (chmod 600)
- [ ] Firewall enabled (UFW)
- [ ] SSL certificate installed
- [ ] Environment variables in .env (not hardcoded)
- [ ] API keys never logged
- [ ] Database credentials secured
- [ ] Regular backups enabled
- [ ] PM2 startup on reboot configured

---

## SCALING (Future)

If you need to scale:
1. Add database (MongoDB/PostgreSQL) for persistent task storage
2. Add Redis for task queue caching
3. Deploy multiple Manager instances with load balancing
4. Add health checks and monitoring (DataDog, New Relic)

---

## SUPPORT

For issues, check:
- Hostinger documentation: https://support.hostinger.com
- Node.js docs: https://nodejs.org/docs
- PM2 docs: https://pm2.keymetrics.io
- Nginx docs: https://nginx.org/en/docs
