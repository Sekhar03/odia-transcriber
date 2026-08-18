# Contributing to OdiaTube AI Transcriber 🎙️

Thank you for your interest in contributing to **OdiaTube AI Transcriber**! We welcome and appreciate contributions of all kinds, whether you are fixing a bug, adding translation support for a new language, improving the PDF rendering engine, or enhancing the frontend UI.

By contributing to this project, you help make speech-to-text transcription and translation more accessible to speakers of Odia and other Indic/global languages.

---

## 🗺️ Table of Contents
1. [Code of Conduct](#-code-of-conduct)
2. [How Can I Contribute?](#-how-can-i-contribute)
3. [Branching Workflow & Staging](#-branching-workflow--staging)
4. [Local Development Setup](#-local-development-setup)
5. [Pull Request Guidelines](#-pull-request-guidelines)
6. [Reporting Bugs & Suggesting Features](#-reporting-bugs--suggesting-features)

---

## 🤝 Code of Conduct
We aim to foster an open, welcoming, and inclusive community. Please be respectful, constructive, and collaborative in all interactions (Issues, Pull Requests, and discussions).

---

## 💡 How Can I Contribute?

You can contribute in several ways:
- **Adding / Improving Translation Support**: Help refine IndicTrans2 or NLLB-200 translation pipelines for specific languages.
- **UI/UX Enhancements**: Improve the React frontend, add better visual cues, or enhance dark-mode aesthetics.
- **Bug Fixes**: Resolve issue reports, ASR clean-up quirks, or font encoding box glitches in generated PDFs.
- **Documentation**: Improve this guide, setup guides, or API endpoints documentation.

---

## 🌿 Branching Workflow & Staging

To maintain stability and ease of integration, we follow a standard branching workflow:

* **`main`**: The production branch. This represents the stable, deployed version of the application. Direct commits to `main` are restricted.
* **`staging`**: The pre-production staging branch. Used for testing release candidates and final verification before merging into `main`.
* **`dev`**: The integration branch. All active development is merged here first.
* **`feature/*` or `bugfix/*`**: Temporary feature or bugfix branches created for specific tasks.

### Workflow Steps:
1. **Fork** the repository to your own GitHub account.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/your-username/transacribe-odia.git
   ```
3. Create a feature branch off of the `dev` branch:
   ```bash
   git checkout dev
   git checkout -b feature/your-feature-name
   ```
4. Commit your changes and push them to your fork.
5. Submit a Pull Request (PR) from your feature branch to the **`dev`** branch of the main repository.

---

## 🛠️ Local Development Setup

Follow these steps to run the application locally:

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- Optional: **Python** (for running the local translation server training/inference scripts)

### 2. Installation
Install root backend and client frontend dependencies:
```bash
# Install root backend dependencies
npm install

# Install frontend dependencies
npm --prefix client install
```

### 3. Environment Variables
Create a `.env` file in the root folder and client directory. Reference [`.env.example`](file:///c:/Users/sekha/Downloads/transacribe%20odia/.env.example) for required configuration:
- `VITE_GOOGLE_CLIENT_ID`: Required for reliable client-side caption fetching.
- `HF_TOKEN`: Optional, if you wish to run inference against Hugging Face's IndicTrans2 models.

### 4. Running the Dev Servers
Start both the Express backend and the Vite frontend:
```bash
# Start backend (auto-builds/serves client if client/dist is generated)
npm start

# For frontend hot-reloading (in a separate terminal):
cd client && npm run dev
```

---

## 📝 Pull Request Guidelines

Before submitting a Pull Request, please ensure:
- Your code is clean, readable, and well-commented where necessary.
- You have verified your changes locally and they do not break existing features.
- PDF generation works correctly, especially Unicode rendering (make sure there are no `□` glyphs for languages like Odia).
- You write descriptive commit messages (e.g., `feat(ui): add target language flags to selector dropdown`).
- Your PR description outlines what you changed, why, and how to test it.

---

## 🐛 Reporting Bugs & Suggesting Features

If you find a bug or have a feature suggestion, please open an Issue:
1. Use a clear and descriptive title.
2. Describe the steps to reproduce the bug, including the YouTube video URL you used.
3. Share the expected vs. actual behavior.
4. Add screenshots if it's a UI or PDF formatting issue.
