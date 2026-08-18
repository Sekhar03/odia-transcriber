const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const helmet = require('helmet');
const { getYouTubeData } = require('./services/youtubeService');
const { translateLinesToTargetLanguage, translateSingleText } = require('./services/translateService');
const { createOdiaPDF } = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Explicit CORS middleware for cloud cross-domain requests
// Note: CORS is set to * as this is a public API without authentication
// The app only processes public YouTube URLs and doesn't handle sensitive user data
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Max-Age', '86400');
  
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

const { processContent } = require('./services/aiCleanerService');

// API: Transcribe YouTube Video to Odia or English
app.post('/api/transcribe', async (req, res) => {
  const debugLogs = [];
  try {
    const { url, targetLang = 'or' } = req.body;
    
    // Input validation
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'YouTube video URL is required.' });
    }
    
    // Validate target language
    const validLangs = ['or', 'en', 'hi'];
    if (!validLangs.includes(targetLang)) {
      return res.status(400).json({ success: false, error: 'Invalid target language. Supported: or, en, hi' });
    }
    
    // Sanitize URL to prevent injection attacks
    const sanitizedUrl = url.trim().substring(0, 500); // Limit length
    
    console.log(`[API /api/transcribe] Processing YouTube URL (Target: ${targetLang})`);
    
    const progressLogs = [];
    const onProgressUpdate = (step) => {
      console.log(`[Pipeline Progress] Step: ${step}`);
      progressLogs.push(step);
    };

    const ytData = await getYouTubeData(sanitizedUrl, onProgressUpdate, debugLogs);
    
    // Assign unique IDs to prevent duplicate mappings on identical offsets
    ytData.lines = ytData.lines.map((l, idx) => ({ ...l, id: idx }));

    // Repetition Detection & Summarization
    console.log(`[API /api/transcribe] Cleaning repetitions and generating summary...`);
    const { cleanedLines, summary } = await processContent(ytData.lines, targetLang);

    console.log(`[API /api/transcribe] Extracted ${cleanedLines.length} cleaned dialogue lines. Translating to ${targetLang}...`);
    const translatedLines = await translateLinesToTargetLanguage(cleanedLines, targetLang, onProgressUpdate);

    // Update summary sections with translated lines matching by unique ID
    const translatedSections = (summary.sections || []).map(sec => {
      return {
        title: sec.title,
        lines: sec.lines.map(l => {
          const match = translatedLines.find(t => t.id === l.id);
          return match ? match : { ...l, odiaText: l.text };
        })
      };
    });

    return res.json({
      success: true,
      metadata: ytData.metadata,
      sourceLanguage: ytData.sourceLanguage,
      targetLang,
      lines: translatedLines.map(l => ({ ...l, odiaText: l.translatedText })),
      summary: {
        ...summary,
        sections: translatedSections
      },
      progressSteps: progressLogs
    });
  } catch (err) {
    console.error('[API /api/transcribe Error]', err.message);
    return res.status(500).json({
      success: false,
      error: 'An error occurred during transcription. Please try again.',
      correlationId: Date.now().toString()
    });
  }
});

// API: Quick Translate snippet
app.post('/api/translate-text', async (req, res) => {
  try {
    const { text, targetLang = 'or' } = req.body;
    
    // Input validation
    if (!text || typeof text !== 'string') {
      return res.json({ success: true, translatedText: '' });
    }
    
    // Validate target language
    const validLangs = ['or', 'en', 'hi'];
    if (!validLangs.includes(targetLang)) {
      return res.status(400).json({ success: false, error: 'Invalid target language. Supported: or, en, hi' });
    }
    
    // Sanitize text input
    const sanitizedText = text.trim().substring(0, 5000); // Limit length
    
    const translatedText = await translateSingleText(sanitizedText, targetLang);
    return res.json({ success: true, translatedText });
  } catch (err) {
    console.error('[API /api/translate-text Error]', err.message);
    return res.status(500).json({ success: false, error: 'Translation failed. Please try again.' });
  }
});

// API: Generate & Download PDF (Odia or English)
app.post('/api/generate-pdf', (req, res) => {
  try {
    const { metadata = {}, lines = [], pdfLayout = 'dual', pdfTitle = '', sourceLanguage = 'English / Hindi', targetLang = 'or', summary = {} } = req.body;
    
    // Input validation
    if (!lines || !Array.isArray(lines) || !lines.length) {
      return res.status(400).json({ error: 'No dialogue lines provided for PDF generation.' });
    }
    
    // Validate target language
    const validLangs = ['or', 'en', 'hi'];
    if (!validLangs.includes(targetLang)) {
      return res.status(400).json({ error: 'Invalid target language. Supported: or, en, hi' });
    }
    
    // Validate PDF layout
    const validLayouts = ['dual', 'source', 'target'];
    if (!validLayouts.includes(pdfLayout)) {
      return res.status(400).json({ error: 'Invalid PDF layout. Supported: dual, source, target' });
    }
    
    // Limit lines to prevent DoS
    if (lines.length > 10000) {
      return res.status(400).json({ error: 'Too many lines. Maximum 10000 lines allowed.' });
    }

    const rawTitle = pdfTitle || metadata?.title || `YouTube_Dialogue_${targetLang.toUpperCase()}`;
    const safeFilename = (rawTitle
      .replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 40) || `YouTube_Dialogue_${targetLang.toUpperCase()}`) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Sync summary sections with potentially edited main lines
    let finalSummary = summary;
    if (summary && summary.sections) {
      finalSummary = {
        ...summary,
        sections: summary.sections.map(sec => ({
          ...sec,
          lines: sec.lines.map(secLine => {
            const match = lines.find(l => l.id === secLine.id);
            return match ? match : secLine;
          })
        }))
      };
    } else {
      // Create fallback section if summary doesn't exist
      finalSummary = {
        sections: [{ title: targetLang === 'or' ? 'ସଂଳାପ ବିବରଣୀ' : 'Dialogue Transcript', lines }]
      };
    }

    createOdiaPDF({ metadata, lines, pdfLayout, pdfTitle: rawTitle, sourceLanguage, targetLang, summary: finalSummary }, res);
  } catch (err) {
    console.error('[API /api/generate-pdf Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'PDF generation failed. Please try again.' });
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
