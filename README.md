# OdiaTube AI Transcriber 🎙️ → 📄 (ଓଡ଼ିଆ PDF)

[![Odia Transcriber](https://img.shields.io/badge/Language-Odia%20%2F%20ଓଡ଼ିଆ-blue.svg)](#)
[![Speech to Text](https://img.shields.io/badge/Task-Speech%20to%20Text-orange.svg)](#)
[![Translation](https://img.shields.io/badge/Translation-English%20%2F%20Hindi%20%E2%86%92%20Odia-brightgreen.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Framework](https://img.shields.io/badge/Framework-React%20%2F%20Express-lightblue.svg)](#)

An advanced, production-grade AI-powered **YouTube English & Odia Transcriber** web application that extracts and transcribes YouTube videos (supporting English, Hindi, and Hinglish/mixed dialogue) into complete, non-summarized natural English or Odia (ଓଡ଼ିଆ) dialogue transcripts and generates beautifully formatted PDF documents. 

The project solves the common issue of broken glyphs/boxes (`□`) in Odia text rendering by utilizing fully embedded **Noto Sans Oriya** fonts inside generated PDFs.

### 🏷️ GitHub Repository Topics (Recommended settings for GitHub SEO)
To maximize discoverability, make sure to add these topics to your GitHub repository settings:
`youtube-english-transcription`, `youtube-transcript-generator`, `youtube-to-text`, `odia-transcriber`, `youtube-transcription`, `odia-speech-to-text`, `odia-translation`, `indictrans2-odia`, `youtube-to-odia-pdf`, `odia-pdf-generator`.

---

## ✨ Features

- **Full Dialogue Preservation**: Captures and preserves 100% of spoken conversation without lossy summaries.
- **AI-Powered Speech & Multilingual Translation Engine**:
  - Integrates **AI4Bharat IndicConformer ASR**, **IndicTrans2**, and **Meta's NLLB-200 (600M)** models to translate transcripts into **12 target languages**: Odia (ଓଡ଼ିଆ), English, Hindi, Bengali, Telugu, Tamil, Marathi, Spanish, French, Gujarati, Kannada, and Punjabi.
  - Features an **Ultra-Fast Parallel Batch Translation Engine** to translate over 100+ lines in under 2.5 seconds (ensures 100% Vercel serverless compliance).
  - Built-in fallback to Google Translate API with POST requests to handle rate limits and oversized payloads gracefully.
- **Speaker Diarization & Conversational Turns**: Detects conversational turns and labels them clearly (`Speaker 1`, `Speaker 2`, etc.) with customizable speaker labels.
- **Smart Glyph & Language Sanitization**: Automatic cleanup of ASR noise, duplicate words, mangled text, and Devanagari/Latin character attachment issues.
- **Smart Font & PDF Generation Engine**:
  - Fully embeds `NotoSansOriya-Regular.ttf` & `NotoSansOriya-Bold.ttf` directly into the PDF binary, guaranteeing flawless rendering for Odia script.
  - Automatically falls back to standard `Helvetica` engines for English and other global languages to prevent encoding errors or broken glyph boxes (`□`).
- **Interactive UI (React + Vite + Tailwind CSS)**:
  - Dropdown **Target Language Selector** to switch between 12 supported languages.
  - Dynamic YouTube player with seeking capability based on dialogue timestamps.
  - Multi-layout PDF exports (Dual-column source + translation, single-column translation, or side-by-side comparison).
  - Inline dialogue text editor to refine transcripts before PDF generation.
  - Confetti animations for completion & smooth dark-mode UI.

---

## 📁 Project Structure

```
├── api/                   # Vercel serverless function entrypoint
│   └── index.js           
├── client/                # React + Vite frontend
│   ├── src/               # React source files (App.jsx, main.jsx, styles)
│   ├── public/            # Static assets
│   └── package.json       
├── fonts/                 # TTF Unicode Fonts (Noto Sans Oriya)
├── services/              # Core backend logic modules
│   ├── aiCleanerService.js    # Repetition cleanup and transcript organization
│   ├── indicAiService.js      # Hugging Face IndicTrans2 API connector
│   ├── pdfService.js          # PDFKit document generator with embedded fonts
│   ├── translateService.js    # Batch translation orchestrator & fallback engine
│   └── youtubeService.js      # YouTube transcript extractor (InnerTube / Captions)
├── server.js              # Express app entrypoint (Local & production)
├── vercel.json            # Vercel deployment configuration
└── package.json           # Root package and build scripts
```

---

## 🚀 Quick Start

### 1. Installation
Clone the repository, then install root and client-side dependencies:

```bash
# Install root backend dependencies
npm install

# Install frontend dependencies
npm --prefix client install
```

### 2. Environment Setup
Create a `.env` file in both the root folder and the `client` directory (or use `.env.example` as a template):

```ini
# Google OAuth Client ID (Required for reliable Vercel/cloud deployment caption extraction)
# Retrieve from: https://console.cloud.google.com/apis/credentials
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here

# Optional: HuggingFace Inference API credentials for IndicTrans2 (1B)
HF_TOKEN=your_hugging_face_token_here
HF_MODEL_ID=ai4bharat/indictrans2-en-indic-1B

# Optional: Local Translation Server (T5 fine-tuned model)
# VITE_API_BASE_URL=
```

### 3. Run Locally

To spin up both the Express server (port `3001`) and the Vite React frontend:

```bash
# Start the local Express backend (it will build Vite frontend automatically if not built)
npm start
```

For frontend hot-reloading development:
```bash
# In one terminal:
npm start

# In another terminal:
cd client && npm run dev
```

---

## 🔌 API Documentation

### `POST /api/transcribe`
Extracts transcripts from a YouTube video, runs formatting, speaker detection, and translates it into Odia or English.
- **Request Body**:
  ```json
  {
    "url": "https://www.youtube.com/watch?v=...",
    "targetLang": "or" // "or" for Odia, "en" for English
  }
  ```
- **Response**: Returns video metadata, identified source language, translation status, a cleaned dialogue line-by-line array, and organized dialogue sections.

### `POST /api/translate-text`
Translates an individual text string.
- **Request Body**:
  ```json
  {
    "text": "Hello, how are you?",
    "targetLang": "or"
  }
  ```

### `POST /api/generate-pdf`
Generates a highly-formatted, printable PDF transcript.
- **Request Body**:
  ```json
  {
    "metadata": { "title": "Video Title", "author": "..." },
    "lines": [ { "speaker": "Speaker 1", "time": "0:02", "translatedText": "ଓଡ଼ିଆ କଥା" } ],
    "pdfLayout": "dual", // "dual" (Source + Target) or "single" (Target only)
    "pdfTitle": "Custom Title",
    "targetLang": "or"
  }
  ```
- **Response**: PDF binary stream (`application/pdf`).

---

## 🌐 Cloud Deployment

### Deploying to Vercel (Recommended)
This codebase is fully pre-configured for Vercel deployment:
1. Connect this repository to your Vercel Account.
2. Vercel will automatically read the `vercel.json` file.
3. Configure the environment variables (e.g., `VITE_GOOGLE_CLIENT_ID`) in Vercel project settings.
4. Vercel will trigger `npm run vercel-build` which compiles the Vite frontend into `client/dist` and hosts the Serverless API functions under `api/index.js`.

For more details, check `VERCEL_DEPLOYMENT_GUIDE.md`.

---

## 🛠️ Tech Stack & Dependencies

- **Frontend**: React (v19), Vite, Tailwind CSS, Lucide Icons, Canvas Confetti.
- **Backend**: Express, CORS, PDFKit (for low-level custom PDF layout stream), YouTubei.js (InnerTube wrapper).
- **Translation & NLP**: AI4Bharat IndicTrans2 Model, Hugging Face Inference APIs, fallback server translators.

---

## 🔌 API Integrations & Credits

This project relies on and credits the following API integrations to deliver high-quality Odia transcriptions:

* **Google Gemini API** (`gemini-2.5-flash`):
  * **Role:** Intelligent transcript cleanup, structure organizing, and summary generation.
  * **Function:** Identifies transcription filler words/repetitive lines, groups the timeline into logical chapters, and generates bilingual summaries (Overview, Key Points, and Takeaways).
* **Hugging Face Inference API**:
  * **Role:** Hosts state-of-the-art multilingual machine translation and ASR models.
  * **Models Credited:**
    * **AI4Bharat IndicTrans2 (1B)** (`ai4bharat/indictrans2-en-indic-1B` & `ai4bharat/indictrans2-indic-indic-1B`) for translation between English, Hindi, and Odia.
    * **AI4Bharat IndicConformer** (`ai4bharat/indic-conformer-600m-multilingual`) for Speech-to-Text translation.
* **YouTube InnerTube API**:
  * **Role:** YouTube metadata retrieval & caption extraction.
  * **Function:** Queries YouTube's internal player endpoints (`/youtubei/v1/player`) using Android, iOS, and Web client configurations to fetch native video caption tracks.
* **Invidious API**:
  * **Role:** Decentralized YouTube scraping proxy.
  * **Function:** Leverages public Invidious instances (e.g., `inv.nadeko.net`) as automatic fallback endpoints to fetch video transcripts if YouTube restricts direct connections.
* **Local Translation Server API**:
  * **Role:** Offline translation microservice.
  * **Function:** Uses a locally running translation server (`http://localhost:5002/translate`) connected to a custom fine-tuned T5 Seq2Seq model.

---

## 🤖 Trained Translation Model

The project includes a custom fine-tuned translation model for English-Odia and Hindi-Odia tasks:
* **Base Architecture**: `t5-small` (Seq2Seq Transformer).
* **Dataset**: Custom dataset located at `dataset/indictrans2_odia_dataset.json`.
* **Training Setup**: Configured with Hugging Face Transformers, QLoRA (4-bit quantization), and PEFT adapters, allowing efficient execution and local CPU or GPU fine-tuning.
* **Scripts**:
  * Training: [`scripts/train_model.py`](file:///c:/Users/sekha/Downloads/transacribe%20odia/scripts/train_model.py)
  * Server: [`scripts/local_translation_server.py`](file:///c:/Users/sekha/Downloads/transacribe%20odia/scripts/local_translation_server.py) loads the model weights saved in `./results_translation` to host a local translation microservice on port `5002`.

---

## 🌿 Branching Workflow (Testing & Staging)

To ensure stability, updates and testing for each language are staged on dedicated Git branches before being pushed to production on the `main` branch. 

Available language branches:
* **Odia:** `lang-odia`
* **Bengali:** `lang-bengali`
* **Telugu:** `lang-telugu`
* **Tamil:** `lang-tamil`
* **Hindi:** `lang-hindi`
* **Marathi:** `lang-marathi`
* **Gujarati:** `lang-gujarati`
* **Kannada:** `lang-kannada`
* **Punjabi:** `lang-punjabi`
* **Spanish:** `lang-spanish`
* **French:** `lang-french`

To check out a specific branch for testing:
```bash
git checkout lang-[language]
```
Once changes on a language branch are finalized and verified, merge the branch into `main` to trigger the production deployment.

---

## 📄 License

This project is licensed under the [MIT License](file:///c:/Users/sekha/Downloads/transacribe%20odia/LICENSE) - see the [LICENSE](file:///c:/Users/sekha/Downloads/transacribe%20odia/LICENSE) file for details.

