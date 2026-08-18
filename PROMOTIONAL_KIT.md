# 🚀 Developer Outreach & Promotional Kit

This kit contains all the pre-written copy, tags, and strategies you need to invite developers and announce the open-sourcing of **OdiaTube AI Transcriber**. 

Simply copy, paste, and customize the templates below to spread the word!

---

## 🗺️ Contents
1. [GitHub Repository Checklist](#1-github-repository-checklist)
2. [LinkedIn Announcement](#2-linkedin-announcement)
3. [Twitter / X Thread](#3-twitter--x-thread)
4. [Reddit Post (r/opensource, r/reactjs)](#4-reddit-post)
5. [Developer Blog Draft (Dev.to / Hashnode)](#5-developer-blog-draft)

---

## 1. GitHub Repository Checklist

Before posting, update these settings in your GitHub Repository UI:
- **Topics / Tags**: Add these topics to maximize search SEO:
  `youtube-transcription`, `odia-transcriber`, `odia-translation`, `open-source`, `react`, `express-api`, `pdfkit`, `indictrans2`, `speech-to-text`.
- **Description**: Add a short, punchy bio:
  > "🎙️ AI-powered YouTube English & Odia Transcriber web app. Generates perfectly formatted PDFs with embedded Noto Sans Oriya fonts, resolving broken glyphs."

---

## 2. LinkedIn Announcement

**Target Audience:** Professionals, developers, and tech networks.
**Aesthetics:** Professional, achievement-focused, and collaborative.

### Copy:
```text
🚀 I am excited to announce that OdiaTube AI Transcriber is now officially OPEN SOURCE! 

OdiaTube ASR & Translator is a React + Express web application that transcribes YouTube videos (supporting English, Hindi, and mixed-dialogue) and translates them into Odia and 11 other Indic/global languages, generating beautifully formatted, print-ready PDFs.

One of the key challenges we solved was the common issue of broken glyph boxes (□) when rendering Unicode Odia fonts in PDFs. We accomplished this by embedding Noto Sans Oriya fonts directly into the binary stream using custom PDFKit rendering.

Check out the code here: [INSERT YOUR GITHUB URL]

🤝 We are inviting developers to contribute! Whether you want to:
• Expand multilingual translation models (IndicTrans2, NLLB-200)
• Improve React/Tailwind frontend components
• Polish PDF layout engines
• Fix ASR text cleanup edge cases

Read our Contributing Guide to get started: [INSERT YOUR GITHUB URL]/blob/main/CONTRIBUTING.md

Let's build better tooling for Indic languages together! 

#OpenSource #ReactJS #NodeJS #OdiaTech #SoftwareEngineering #IndicNLP #BuildInPublic
```

---

## 3. Twitter / X Thread

**Target Audience:** Open-source contributors, indie hackers.
**Aesthetics:** Visual, fast-paced, high engagement.

### Tweet 1 (Hook):
```text
OdiaTube AI Transcriber is now officially OPEN SOURCE! 🎙️ -> 📄

It transcribes YouTube videos (English/Hindi/mixed) and translates them into Odia and 11 other languages, producing clean PDFs.

How it works & how to contribute: 🧵👇
[INSERT YOUR GITHUB URL]
```

### Tweet 2 (The PDF Problem):
```text
1/ Rendering Odia script in PDFs usually results in broken boxes (□) due to poor system font support. 

We solved this by embedding Noto Sans Oriya TTF fonts directly into custom PDFKit streams, ensuring perfect glyph rendering on any device.
```

### Tweet 3 (The Tech Stack):
```text
2/ The Stack:
• Frontend: React 19, Vite, Tailwind CSS
• Backend: Express, Vercel Serverless Functions
• AI: Google Gemini (transcript cleanup & summarization), IndicTrans2/NLLB-200 (parallel batch translation engine translating 100+ lines in under 2.5s)
```

### Tweet 4 (Call to Action):
```text
3/ We'd love your contributions! We have structured the repository with clear `dev` and `staging` branches to easily collaborate. 

Check out the CONTRIBUTING guide to get started:
[INSERT YOUR GITHUB URL]/blob/main/CONTRIBUTING.md 🚀
```

---

## 4. Reddit Post

**Target Subreddits:** `r/opensource`, `r/reactjs`, `r/node`, `r/Odisha`
**Aesthetics:** Story-driven, technical, community-first.

### Title:
> I open-sourced an AI YouTube Transcriber to Odia/Indic languages (React, Node, IndicTrans2) - Solved the broken PDF glyphs problem!

### Body:
```markdown
Hey everyone!

I wanted to share a project I've been working on that I've just open-sourced: **OdiaTube AI Transcriber**.

It's a web application built using React (Vite) and Express that extracts dialogue from YouTube videos, translates them into Odia (ଓଡ଼ିଆ) plus 11 other regional/global languages, and generates structured PDF transcripts.

### 🛠️ The Tech & Challenges Solved:
1. **Broken PDF Glyphs:** Standard PDF generators fail to render Odia characters, showing empty boxes (`□`). I built a custom rendering engine using PDFKit that embeds `NotoSansOriya-Regular.ttf` & `NotoSansOriya-Bold.ttf` directly into the binary stream.
2. **Translation Speed:** Integrates AI4Bharat's IndicTrans2 and Meta's NLLB-200. Built a parallel batch translation pipeline that handles 100+ dialogue lines in under 2.5 seconds to comply with Vercel's Serverless timeout limits.
3. **Structured Workflows:** Setup with standard `main`, `staging`, and `dev` branches for clean git-flow collaboration.

### 🤝 How to Contribute:
I am actively inviting developers, designers, and translators to contribute. Whether you want to refine UI micro-interactions, optimize backend APIs, or improve localized speech-to-text models, all help is welcome!

* **GitHub Repository:** [INSERT YOUR GITHUB URL]
* **Contributing Guide:** [INSERT YOUR GITHUB URL]/blob/main/CONTRIBUTING.md

Let me know what you think or if you have any questions about the translation pipeline!
```

---

## 5. Developer Blog Draft

**Target Platforms:** Dev.to, Hashnode, Medium.

### Title:
> Why and How I Open-Sourced a YouTube-to-Odia PDF Transcriber

### Main Outline:
- **The Problem:** Non-English speakers have limited access to high-quality transcriptions and translations of global media.
- **The Technical Deep Dive:**
  - Setting up the React + Express architecture.
  - Getting YouTube captions reliably via InnerTube APIs.
  - Solving ASR noise, text duplicates, and the PDF font embedding mechanism.
- **Why Open Source?** To invite others to expand support for more regional Indic languages, enhance translation models, and build a localized platform.
- **Call to Action:** Direct readers to your GitHub repository and encourage them to pick up a `good first issue`.
