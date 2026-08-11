# OdiaTube AI Transcriber 🎙️ → 📄 (ଓଡ଼ିଆ PDF)

An AI-powered web application that transcribes English, Hindi, and Hinglish YouTube videos into complete, non-summarized natural Odia dialogue (ଓଡ଼ିଆ) and exports formatted PDF documents with embedded **Noto Sans Oriya** fonts.

---

## ✨ Features

- **Full Dialogue Preservation**: Preserves 100% of spoken conversation without summarizing.
- **AI Speech & Translation Engine**: Integrates AI4Bharat IndicConformer ASR & IndicTrans2 (1B) multilingual models for English/Hindi → Odia.
- **Speaker Diarization**: Detects conversational turns and labels `Speaker 1`, `Speaker 2`, etc.
- **Code-Switching Support**: Seamlessly handles mixed Hindi + English ("Hinglish") speech.
- **Embedded Odia Fonts**: Embedded `NotoSansOriya-Regular.ttf` & `NotoSansOriya-Bold.ttf` guarantee 0 broken boxes (`□`) in generated PDFs.
- **Interactive UI**: YouTube player with timestamp seeking, speaker filtering, and inline Odia script editor.
- **Vercel Deployment Ready**: Preconfigured with `vercel.json` and Serverless Function entry point (`api/index.js`).

---

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   npm --prefix client install
   ```

2. Start the application:
   ```bash
   npm start
   ```

3. Open `http://localhost:3001` in your browser.

---

## 🌐 Deploy to Vercel

### Deploy

```bash
npm run vercel-build
```

Deploy directly via Vercel CLI or import the GitHub repository into the Vercel Dashboard.

**Note**: The application uses direct server-side InnerTube API calls (no CORS proxies) to extract YouTube captions reliably on Vercel and other cloud deployments. No API key is required.
