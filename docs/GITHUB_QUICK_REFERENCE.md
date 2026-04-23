# HAMH GitHub Launch — Quick Reference

## 🚀 One-Liner Launch (if repo exists)

```bash
git remote add origin https://YOUR_TOKEN@github.com/oddsify-labs/hamh.git && \
git branch -M main && \
git push -u origin main
```

## 📋 Step-by-Step (Recommended)

### 1. Prepare
```bash
cd /path/to/hamh
git status  # Check all files are ready
```

### 2. Configure Git
```bash
git config user.name "Oddsify Labs"
git config user.email "dev@oddsify-labs.com"
git branch -M main
```

### 3. Initial Commit
```bash
git add .
git commit -m "Initial commit: HAMH - Hermes Agent Management Hub

You got them Hermes Agents, we got a Boss for them.

License: MIT
By: Oddsify Labs (A Collins & Collins Technologies Company)"
```

### 4. Add Remote
```bash
git remote add origin https://github.com/oddsify-labs/hamh.git
```

### 5. Push
```bash
git push -u origin main
```

## 🔑 Using Your GitHub Token

**As HTTP Basic Auth:**
```bash
git remote add origin https://USERNAME:TOKEN@github.com/oddsify-labs/hamh.git
```

**Or use credentials cache:**
```bash
git config --global credential.helper cache
git push -u origin main  # Will prompt once, then cache
```

**Or SSH (recommended for future):**
```bash
# After initial push, switch to SSH:
git remote set-url origin git@github.com:oddsify-labs/hamh.git
git push -u origin main
```

## 📁 Repository Structure

Your HAMH repo should have:
```
hamh/
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI/CD pipeline
├── README.md                       # ✓ Done
├── LICENSE                         # ✓ Done (MIT)
├── package.json                    # ✓ Done
├── .env.example                    # ✓ Done
├── manager-agent-server.js         # ✓ Done
├── dashboard-api-client.js         # ✓ Done
├── DEPLOYMENT_GUIDE.md             # ✓ Done
├── PRICING_AND_SERVICES.md         # ✓ Done
├── CONTRIBUTING.md                 # ✓ Done
├── BUSINESS_PLAN.md                # ✓ Done
└── .gitignore                      # Add if needed
```

## 🔗 Important URLs (After Push)

- **Repository:** https://github.com/oddsify-labs/hamh
- **Issues:** https://github.com/oddsify-labs/hamh/issues
- **Discussions:** https://github.com/oddsify-labs/hamh/discussions
- **Actions/CI:** https://github.com/oddsify-labs/hamh/actions
- **Releases:** https://github.com/oddsify-labs/hamh/releases
- **npm Package:** https://www.npmjs.com/package/@oddsify-labs/hamh
- **GitHub Pages:** https://oddsify-labs.github.io/hamh

## ✅ Post-Launch Checklist

After pushing to GitHub:

- [ ] Repository is public
- [ ] README displays correctly
- [ ] LICENSE file visible
- [ ] Add repository topics: hermes, agents, orchestration, nodejs
- [ ] Set repository description
- [ ] Enable Discussions
- [ ] Setup GitHub Pages (optional)
- [ ] Create first Release (v1.0.0)
- [ ] Create Issues templates (optional)
- [ ] Create Pull Request templates (optional)
- [ ] Add branch protection to main
- [ ] Test CI/CD workflow runs

## 🐛 Troubleshooting

**"Permission denied (publickey)"**
```bash
# Switch to HTTPS temporarily
git remote set-url origin https://USERNAME:TOKEN@github.com/oddsify-labs/hamh.git
git push -u origin main
```

**"Repository not found"**
```bash
# Make sure repo exists on GitHub and URL is correct
git remote -v  # Check URL
git remote set-url origin https://correct-url.git
```

**"Updates were rejected"**
```bash
# Pull first, then push
git pull origin main
git push origin main
```

## 📢 Launch Announcement Template

```
🚀 HAMH is LIVE!

HAMH — Hermes Agent Management Hub
You got them Hermes Agents, we got a Boss for them.

📍 Open-source (MIT License)
📍 Built for AI agent orchestration
📍 Enterprise-ready

GitHub: https://github.com/oddsify-labs/hamh
npm: npm install @oddsify-labs/hamh
Docs: https://github.com/oddsify-labs/hamh#readme

#OpenSource #AI #Agents #Hermes
```

## 🎯 Next Steps After Launch

1. **Day 1:** Create first Release (v1.0.0)
2. **Day 2:** Post on Product Hunt
3. **Day 3:** Share on Hacker News
4. **Week 1:** Engage with early users/issues
5. **Week 2:** Blog post: "We're open-sourcing HAMH"
6. **Month 1:** First feature release (v1.1.0)

---

**You got them Hermes Agents, we got a Boss for them.** 🚀

Questions? Check: [GITHUB_LAUNCH_GUIDE.md](GITHUB_LAUNCH_GUIDE.md)
