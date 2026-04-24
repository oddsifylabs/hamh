# 🪟 HAMH on Windows — 3 Easy Methods

Choose the method that works best for you:

---

## ⚡ Method 1: PowerShell (Recommended for Windows)

### Prerequisites:
- Git installed: https://git-scm.com/download/win
- Your GitHub token ready

### Steps:

1. **Download** `hamh-setup.ps1` from this folder to your PC

2. **Open PowerShell** (not as Admin needed)

3. **Navigate** to where you downloaded the script:
   ```powershell
   cd C:\Users\YourName\Downloads
   ```

4. **Allow script execution** (one-time):
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

5. **Run the script** with your GitHub token:
   ```powershell
   .\hamh-setup.ps1 -GitHubToken "YOUR_GITHUB_TOKEN"
   ```

   Replace `YOUR_GITHUB_TOKEN` with your actual token

**Done!** Your GitHub repo will be created. ✅

---

## 🔧 Method 2: Batch File (Simplest)

### Prerequisites:
- Git installed: https://git-scm.com/download/win

### Steps:

1. **Download** `hamh-setup.bat` from this folder

2. **Right-click** `hamh-setup.bat` → **Edit**

3. **Find this line:**
   ```
   set GITHUB_TOKEN=%1
   ```

4. **Replace with your token:**
   ```
   set GITHUB_TOKEN=YOUR_GITHUB_TOKEN
   ```

5. **Save the file** (Ctrl+S)

6. **Double-click** `hamh-setup.bat`

7. **Watch it work!** It will create your GitHub repo

---

## 🐧 Method 3: WSL2 (Best if You Want Linux)

### Prerequisites:
- Windows 10 or 11
- Admin access

### Steps:

1. **Open PowerShell as Administrator**

2. **Install WSL2:**
   ```powershell
   wsl --install
   ```

3. **Restart your PC**

4. **Open PowerShell again** (normal, not admin)

5. **Enter WSL:**
   ```powershell
   wsl
   ```

6. **Navigate to files:**
   ```bash
   cd /mnt/user-data/outputs
   ```

7. **Run the bash script:**
   ```bash
   bash setup-github.sh YOUR_GITHUB_TOKEN
   ```

**Advantage:** You have a full Linux environment on Windows!

---

## Getting Your GitHub Token

1. Go to: https://github.com/settings/tokens/new
2. Fill in:
   - **Name:** HAMH Setup
   - **Expiration:** 90 days
   - **Scope:** repo (check the box)
3. Click **Generate token**
4. **Copy the token** (looks like: `ghp_xXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx`)
5. Keep it safe!

---

## Which Method Should I Use?

| Method | Best For | Difficulty | Time |
|--------|----------|-----------|------|
| **PowerShell** | Windows users | Easy | 2 min |
| **Batch File** | Simplest setup | Very Easy | 1 min |
| **WSL2** | Learning Linux | Medium | 15 min |

**Most Windows users:** Use **Method 1 (PowerShell)** ⭐

---

## Troubleshooting

### "Git command not found"
→ Install Git: https://git-scm.com/download/win

### "Access denied" (PowerShell)
→ Run Command Prompt as Administrator instead

### "GitHub token rejected"
→ Check token is correct, create a new one

### "Repository already exists"
→ Delete the empty repository on GitHub and try again

---

## After Setup Works ✅

Your GitHub repo will be at:
```
https://github.com/oddsify-labs/hamh
```

You should see:
- ✅ README.md displayed
- ✅ All files in folders
- ✅ Green checkmark on Actions

---

## Next Steps

1. Visit your GitHub repo
2. Add repository description
3. Add topics: hermes, agents, orchestration, nodejs
4. Delete your token for security
5. Announce on social media!

---

## 🎯 Quick Reference

**PowerShell:**
```powershell
.\hamh-setup.ps1 -GitHubToken "YOUR_TOKEN"
```

**Batch:**
- Edit file with your token
- Double-click to run

**WSL2:**
```bash
bash setup-github.sh YOUR_TOKEN
```

---

## Need Help?

- **PowerShell not working?** Use Batch file instead
- **Git not installed?** Download from https://git-scm.com
- **Token issues?** Create a new one at https://github.com/settings/tokens

---

**"You got them Hermes Agents, we got a Boss for them."** 🚀

Choose a method above and get your HAMH on GitHub! ⭐
