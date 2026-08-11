const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { getYouTubeData } = require('./services/youtubeService');
const { translateLinesToTargetLanguage, translateSingleText } = require('./services/translateService');
const { createOdiaPDF } = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3001;

// Explicit CORS middleware for cloud cross-domain requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure frontend build exists on cloud deployments (Render, Railway, Heroku)
const distPath = path.join(__dirname, 'client/dist');
if (!fs.existsSync(distPath)) {
  console.log('[Cloud Deployment] Building React frontend bundle...');
  try {
    execSync('npx vite build client', { stdio: 'inherit' });
    console.log('[Cloud Deployment] React frontend built successfully!');
  } catch (err) {
    console.error('[Cloud Deployment] Frontend build error:', err.message);
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API: Transcribe YouTube Video to Odia or English
app.post('/api/transcribe', async (req, res) => {
  try {
    const { url, targetLang = 'or' } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'YouTube video URL is required.' });
    }

    console.log(`[API /api/transcribe] Processing YouTube URL: ${url} (Target: ${targetLang})`);
    
    const progressLogs = [];
    const onProgressUpdate = (step) => {
      console.log(`[Pipeline Progress] Step: ${step}`);
      progressLogs.push(step);
    };

    const ytData = await getYouTubeData(url, onProgressUpdate);
    
    console.log(`[API /api/transcribe] Extracted ${ytData.lines.length} dialogue lines. Translating to ${targetLang}...`);
    const translatedLines = await translateLinesToTargetLanguage(ytData.lines, targetLang, onProgressUpdate);

    return res.json({
      success: true,
      metadata: ytData.metadata,
      sourceLanguage: ytData.sourceLanguage,
      targetLang,
      lines: translatedLines.map(l => ({ ...l, odiaText: l.translatedText })),
      progressSteps: progressLogs
    });
  } catch (err) {
    console.error('[API /api/transcribe Error]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Quick Translate snippet
app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, targetLang = 'or' } = req.body;
    if (!text) return res.json({ success: true, translatedText: '' });
    const translatedText = await translateSingleText(text, targetLang);
    return res.json({ success: true, translatedText });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API: Generate & Download PDF (Odia or English)
app.post('/api/generate-pdf', (req, res) => {
  try {
    const { metadata = {}, lines = [], pdfLayout = 'dual', pdfTitle = '', sourceLanguage = 'English / Hindi', targetLang = 'or' } = req.body;
    if (!lines || !lines.length) {
      return res.status(400).json({ error: 'No dialogue lines provided for PDF generation.' });
    }

    const rawTitle = pdfTitle || metadata?.title || `YouTube_Dialogue_${targetLang.toUpperCase()}`;
    const safeFilename = (rawTitle
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 40) || `YouTube_Dialogue_${targetLang.toUpperCase()}`) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    createOdiaPDF({ metadata, lines, pdfLayout, pdfTitle: rawTitle, sourceLanguage, targetLang }, res);
  } catch (err) {
    console.error('[API /api/generate-pdf Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// Serve static frontend build
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(200).send('OdiaTube API Server is running.');
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 AI YouTube Transcriber Server running on http://localhost:${PORT}`);
    console.log(`=================================================`);
  });
}

module.exports = app;
