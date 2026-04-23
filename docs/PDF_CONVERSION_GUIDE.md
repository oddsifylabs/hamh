# How to Convert HAMH Deployment Guide to PDF

The `HAMH_DEPLOYMENT_GUIDE.html` file is already formatted and styled to be PDF-friendly. Here are several ways to convert it to PDF:

## Option 1: Using Your Web Browser (Easiest)

### Chrome/Chromium
1. Open `HAMH_DEPLOYMENT_GUIDE.html` in Chrome
2. Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (Mac)
3. Click **"Save as PDF"**
4. Set:
   - **Margin:** Minimal
   - **Headers/Footers:** Off
   - **Background graphics:** On (for colored sections)
5. Click **Save**

### Firefox
1. Open `HAMH_DEPLOYMENT_GUIDE.html` in Firefox
2. Press `Ctrl+P` (Windows/Linux) or `Cmd+P` (Mac)
3. Under **Printer**, select **"Print to File"**
4. Choose PDF format and click **Print**

### Safari (Mac)
1. Open `HAMH_DEPLOYMENT_GUIDE.html` in Safari
2. Press `Cmd+P`
3. Click **PDF** button at bottom left
4. Select **Save as PDF**
5. Click **Save**

---

## Option 2: Using Command Line Tools

### Using wkhtmltopdf (Linux/Mac/Windows)

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install wkhtmltopdf

# macOS (with Homebrew)
brew install --cask wkhtmltopdf

# Windows (from installer)
# Download from: https://wkhtmltopdf.org/downloads.html
```

**Convert to PDF:**
```bash
wkhtmltopdf HAMH_DEPLOYMENT_GUIDE.html HAMH_DEPLOYMENT_GUIDE.pdf
```

**With options:**
```bash
wkhtmltopdf \
  --margin-top 0.75in \
  --margin-bottom 0.75in \
  --margin-left 0.5in \
  --margin-right 0.5in \
  --print-media-type \
  HAMH_DEPLOYMENT_GUIDE.html HAMH_DEPLOYMENT_GUIDE.pdf
```

### Using Puppeteer (Node.js)

**Installation:**
```bash
npm install puppeteer
```

**Create script (convert.js):**
```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Load the HTML file
  const html = fs.readFileSync('./HAMH_DEPLOYMENT_GUIDE.html', 'utf8');
  await page.setContent(html);
  
  // Generate PDF
  await page.pdf({
    path: 'HAMH_DEPLOYMENT_GUIDE.pdf',
    format: 'A4',
    margin: {
      top: '0.75in',
      right: '0.5in',
      bottom: '0.75in',
      left: '0.5in'
    },
    printBackground: true
  });
  
  await browser.close();
})();
```

**Run:**
```bash
node convert.js
```

### Using Python (WeasyPrint)

**Installation:**
```bash
pip install weasyprint
```

**Create script (convert.py):**
```python
from weasyprint import HTML

HTML('HAMH_DEPLOYMENT_GUIDE.html').write_pdf('HAMH_DEPLOYMENT_GUIDE.pdf')
```

**Run:**
```bash
python convert.py
```

---

## Option 3: Using Online Services

### Using CloudConvert
1. Go to: https://cloudconvert.com/html-to-pdf
2. Upload `HAMH_DEPLOYMENT_GUIDE.html`
3. Click **Convert**
4. Download the PDF

### Using Zamzar
1. Go to: https://www.zamzar.com/convert/html-to-pdf/
2. Upload the HTML file
3. Click **Convert Now**
4. Download the PDF

---

## Option 4: Using Pandoc

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install pandoc texlive-latex-base

# macOS
brew install pandoc
```

**Convert:**
```bash
pandoc HAMH_DEPLOYMENT_GUIDE.html -o HAMH_DEPLOYMENT_GUIDE.pdf
```

---

## Recommended Settings for Best Results

When converting, ensure:
- ✅ **Page size:** A4
- ✅ **Margins:** 0.75" top/bottom, 0.5" left/right
- ✅ **Background graphics:** ON (preserves colored boxes)
- ✅ **Print media type:** ON
- ✅ **Scaling:** 100% (no scaling)

---

## Verify the PDF

After conversion, check:
1. ✅ All text is readable
2. ✅ Code blocks display correctly with dark background
3. ✅ Green accent lines are visible
4. ✅ Colored info/success boxes are visible
5. ✅ Table of contents links work (if PDF reader supports them)
6. ✅ Page breaks occur between sections
7. ✅ Footer appears on final page

---

## Quick One-Liner Commands

**Browser (Mac):**
```bash
open HAMH_DEPLOYMENT_GUIDE.html
# Then Cmd+P → Save as PDF
```

**wkhtmltopdf:**
```bash
wkhtmltopdf HAMH_DEPLOYMENT_GUIDE.html HAMH_DEPLOYMENT_GUIDE.pdf
```

**Python:**
```bash
python -c "from weasyprint import HTML; HTML('HAMH_DEPLOYMENT_GUIDE.html').write_pdf('HAMH_DEPLOYMENT_GUIDE.pdf')"
```

---

## File Structure

After conversion, you'll have:
```
├── HAMH_DEPLOYMENT_GUIDE.html     (original HTML)
└── HAMH_DEPLOYMENT_GUIDE.pdf      (generated PDF)
```

---

## Sharing the PDF

Once converted, you can:
- ✅ Email to team members
- ✅ Upload to GitHub Releases
- ✅ Host on your documentation website
- ✅ Print physically for reference
- ✅ Share via Google Drive or Dropbox

---

## Troubleshooting

**PDF looks different than HTML:**
- Ensure **Print media CSS** is enabled
- Try a different conversion tool
- Check that background colors are included

**Fonts are wrong:**
- Browser fonts are applied by default
- This is normal and expected

**Code blocks cut off:**
- Increase margins or use smaller font
- Some tools have word-wrap options

**Colors not showing:**
- Enable **Print background graphics**
- Use a tool that supports CSS gradients (wkhtmltopdf, puppeteer)

---

## Recommended Tool Rankings

1. **Browser Print (Best for beginners)** - Easy, no software needed
2. **Puppeteer (Best for automation)** - Reliable, Node.js
3. **wkhtmltopdf (Best for command line)** - Fast, good quality
4. **WeasyPrint (Best for Python users)** - Simple, Pythonic
5. **Online services (Best for one-time)** - No installation needed

---

## Next Steps

1. ✅ Convert HTML to PDF using your preferred method
2. ✅ Verify PDF quality
3. ✅ Share with your team
4. ✅ Print for office reference (optional)
5. ✅ Upload to GitHub Releases

---

**Questions?** See the main README.md or contact dev@oddsify-labs.com

You got them Hermes Agents, we got a Boss for them. 🚀
