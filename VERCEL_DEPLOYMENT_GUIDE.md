# Vercel Deployment Guide

This project is fully configured for 1-click deployment on **Vercel** with full support for:
- Express API Serverless Functions (`/api/*`)
- Embedded **Noto Sans Oriya** fonts for PDF generation
- Compiled Vite + React + Tailwind CSS frontend

---

## 🚀 Option 1: Deploy via GitHub (Recommended)

1. Push your project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for YouTube Odia Transcriber"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. Open [Vercel Dashboard](https://vercel.com/new).
3. Click **Import Project** and select your GitHub repository.
4. Vercel will automatically detect `vercel.json` settings:
   - **Framework Preset**: Vite / Other
   - **Build Command**: `npm run vercel-build`
   - **Output Directory**: `client/dist`
5. Click **Deploy**!

---

## ⚡ Option 2: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Run deploy command in project folder:
   ```bash
   vercel
   ```

3. Follow the CLI prompts (press Enter for defaults).
4. Deploy to production:
   ```bash
   vercel --prod
   ```

---

## 📁 Key Vercel Configuration Files Created

- [`vercel.json`](file:///c:/Users/sekha/Downloads/transacribe%20odia/vercel.json): Configures Serverless Function routing and embeds Odia fonts (`fonts/**`).
- [`api/index.js`](file:///c:/Users/sekha/Downloads/transacribe%20odia/api/index.js): Vercel Serverless Function entry point exporting Express app.
- [`package.json`](file:///c:/Users/sekha/Downloads/transacribe%20odia/package.json): Root build scripts (`vercel-build`).
