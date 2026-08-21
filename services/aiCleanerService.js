const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || '';
const { translateSingleText, sanitizeOdiaForPdf } = require('./translateService');


/**
 * Remove exact phrase repetitions inside a single text line (e.g., "hello world hello world" -> "hello world")
 */
function cleanInternalRepetitions(text) {
  if (!text) return '';
  let cleaned = text.trim();

  // Clean consecutive duplicate words or phrases
  // Match duplicate sequences of words (e.g. "Affordable Study IQ. Affordable Study IQ.")
  const words = cleaned.split(/\s+/);
  if (words.length < 2) return cleaned;

  // Simple phrase deduplication: check windows of sizes 2 to 10 words
  for (let sz = 2; sz <= Math.min(10, Math.floor(words.length / 2)); sz++) {
    for (let i = 0; i <= words.length - 2 * sz; i++) {
      const first = words.slice(i, i + sz).join(' ').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      const second = words.slice(i + sz, i + 2 * sz).join(' ').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
      if (first === second) {
        // Found duplicate, splice it out
        words.splice(i + sz, sz);
        cleaned = words.join(' ');
        // Restart check
        return cleanInternalRepetitions(cleaned);
      }
    }
  }

  // Clean duplicate sentences within the text
  const sentences = cleaned.split(/[।.?!\n]+/).map(s => s.trim()).filter(Boolean);
  const uniqueSentences = [];
  for (const s of sentences) {
    if (!uniqueSentences.some(u => getSimilarityScore(u, s) > 0.85)) {
      uniqueSentences.push(s);
    }
  }

  return uniqueSentences.join('. ').trim();
}

/**
 * Jaccard Similarity Score between two strings
 */
function getSimilarityScore(str1, str2) {
  const s1 = new Set(str1.toLowerCase().split(/\s+/));
  const s2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Local Rule-based repetition detection & cleanup for full line list
 */
function cleanRepetitionFallback(lines) {
  const cleaned = [];
  const history = [];

  for (const line of lines) {
    const rawText = line.odiaText || line.text || '';
    const cleanedText = cleanInternalRepetitions(rawText);
    if (!cleanedText) continue;

    // Check similarity against recent lines history (sliding window of 4)
    let isRepetitive = false;
    for (const past of history) {
      if (getSimilarityScore(cleanedText, past) > 0.75) {
        isRepetitive = true;
        break;
      }
    }

    if (!isRepetitive) {
      cleaned.push({
        ...line,
        text: line.text ? cleanInternalRepetitions(line.text) : '',
        odiaText: line.odiaText ? cleanedText : undefined,
        translatedText: line.translatedText ? cleanInternalRepetitions(line.translatedText) : undefined
      });
      history.push(cleanedText);
      if (history.length > 5) history.shift();
    }
  }

  return cleaned;
}

/**
 * Local Rule-based Summarizer & Structurer
 */
function generateSummaryFallback(lines, targetLang = 'or') {
  const textLines = lines.map(l => l.odiaText || l.text || '').filter(Boolean);
  const totalWords = textLines.join(' ').split(/\s+/).length;

  const isOdia = targetLang === 'or';
  const overview = isOdia
    ? `ଏହି ଭିଡିଓରେ ମୋଟ ${lines.length} ଟି ସଂଳାପ ବାକ୍ୟ ରହିଛି। ଏହା ସମ୍ପୂର୍ଣ୍ଣ ପ୍ରାକୃତିକ କଥୋପକଥନ ଏବଂ ପ୍ରମୁଖ ଆଲୋଚନା ବିଷୟବସ୍ତୁ ଉପରେ ଆଧାରିତ।`
    : `This video contains a full dialogue transcript of ${lines.length} lines. It provides comprehensive details covering the discussion points and topics mentioned in the video.`;

  const keyPoints = [];
  // Grab a few prominent sentences (e.g. from beginning, middle, and end) to act as key points
  if (textLines.length > 2) {
    keyPoints.push(textLines[0]);
    if (textLines.length > 10) keyPoints.push(textLines[Math.floor(textLines.length / 2)]);
    if (textLines.length > 5) keyPoints.push(textLines[textLines.length - 2]);
  } else {
    keyPoints.push(isOdia ? "ଭିଡିଓରୁ ପ୍ରମୁଖ ବିନ୍ଦୁଗୁଡ଼ିକ ଏଠାରେ ଦର୍ଶାଯାଇଛି।" : "Key details from the dialogue are highlighted here.");
  }

  const takeaways = isOdia
    ? [
        "ପ୍ରାକୃତିକ ଏବଂ ବିସ୍ତୃତ ଆଲୋଚନା ବିଷୟବସ୍ତୁ।",
        "ପ୍ରମୁଖ ଶବ୍ଦ ଏବଂ ବାକ୍ୟଗୁଡ଼ିକର ସଠିକ୍ ଅନୁବାଦ।"
      ]
    : [
        "Detailed and comprehensive analysis of the main topic.",
        "Accurate speaker dialogue preservation without summarization artifacts."
      ];

  return {
    overview,
    keyPoints,
    takeaways,
    sections: structureSectionsFallback(lines, targetLang)
  };
}

/**
 * Splits lines into sections/chapters based on speaker timeline
 */
function structureSectionsFallback(lines, targetLang = 'or') {
  const sections = [];
  const batchSize = Math.max(10, Math.ceil(lines.length / 5)); // split into ~5 logical chapters
  
  for (let i = 0; i < lines.length; i += batchSize) {
    const chunk = lines.slice(i, i + batchSize);
    const startFormatted = chunk[0].startFormatted || '00:00';
    const endFormatted = chunk[chunk.length - 1].endFormatted || chunk[chunk.length - 1].startFormatted || '00:00';
    
    const num = Math.floor(i / batchSize) + 1;
    const title = targetLang === 'or'
      ? `ଭାଗ ${num} (${startFormatted} - ${endFormatted})`
      : `Section ${num} (${startFormatted} - ${endFormatted})`;

    sections.push({
      title,
      lines: chunk
    });
  }

  return sections;
}

/**
 * AI Powered repetition cleaner & summarizer using Gemini API
 */
async function processContent(lines, targetLang = 'or') {
  // First, apply internal phrase repetition cleaning on raw lines to sanitize them
  let cleanedLines = cleanRepetitionFallback(lines);

  if (!GEMINI_API_KEY) {
    console.log('[AI Cleaner] No Gemini API key found. Using rule-based fallback.');
    const summary = generateSummaryFallback(cleanedLines, targetLang);
    return {
      cleanedLines,
      summary
    };
  }

  try {
    const textBlob = cleanedLines.map((l, idx) => `[Line ${idx}] ${l.odiaText || l.text}`).join('\n').substring(0, 32000);
    const langLabel = targetLang === 'en' ? 'English' : 'Odia (ଓଡ଼ିଆ)';
    const prompt = `You are an expert editor. Analyze this YouTube transcript.
1. Identify any repetitive paragraphs, duplicate/redundant sentences, or transcription filler words and list the line indices that should be REMOVED to clean the text while keeping all unique information.
2. Write a structured summary containing:
   - Overview (2-3 sentences summarizing the video content)
   - Key Points (3-5 bullet points of main topics discussed)
   - Takeaways (2-3 key lessons or takeaways)
3. Group the transcript into 4-6 logical chapters/sections based on topic change. Give each section a title.

IMPORTANT: Generate all text contents (overview, keyPoints, takeaways, and section titles) strictly in the ${langLabel} language.

Respond strictly in JSON format matching this schema:
{
  "removeIndices": [1, 5, 12],
  "overview": "...",
  "keyPoints": ["...", "..."],
  "takeaways": ["...", "..."],
  "sections": [
    { "title": "Section Title", "startLineIndex": 0, "endLineIndex": 15 }
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + '\n\nTranscript:\n' + textBlob }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
    const resJson = await res.json();
    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    const aiData = JSON.parse(responseText);

    // Apply removals
    const removeSet = new Set(aiData.removeIndices || []);
    let finalLines = cleanedLines.filter((_, idx) => !removeSet.has(idx));

    // Map AI sections to lines
    const structuredSections = [];
    const aiSections = aiData.sections || [];
    
    if (aiSections.length > 0) {
      for (const sec of aiSections) {
        const chunk = cleanedLines.slice(sec.startLineIndex || 0, (sec.endLineIndex || 0) + 1);
        if (chunk.length > 0) {
          const startFmt = chunk[0].startFormatted || '00:00';
          const endFmt = chunk[chunk.length - 1].endFormatted || chunk[chunk.length - 1].startFormatted || '00:00';
          structuredSections.push({
            title: `${sec.title} (${startFmt} - ${endFmt})`,
            lines: chunk.filter((_, idx) => !removeSet.has(sec.startLineIndex + idx))
          });
        }
      }
    } else {
      // Fallback section structuring
      structuredSections.push(...structureSectionsFallback(finalLines, targetLang));
    }

    return {
      cleanedLines: finalLines,
      summary: {
        overview: aiData.overview,
        keyPoints: aiData.keyPoints,
        takeaways: aiData.takeaways,
        sections: structuredSections
      }
    };
  } catch (err) {
    console.error('[AI Cleaner] Gemini API error, using fallback:', err.message);
    const summary = generateSummaryFallback(cleanedLines, targetLang);
    return {
      cleanedLines,
      summary
    };
  }
}

async function processMicSpeech(rawText, sourceLang = 'en-US', targetLang = 'or') {
  if (!rawText || !rawText.trim()) {
    return { cleanedText: '', translatedText: '' };
  }

  if (!GEMINI_API_KEY) {
    console.log('[AI Mic Cleaner] No Gemini API key found. Using direct translation.');
    const translatedText = await translateSingleText(rawText, targetLang);
    return {
      cleanedText: rawText,
      translatedText
    };
  }

  try {
    const langLabel = targetLang === 'en' ? 'English' : (targetLang === 'or' ? 'Odia (ଓଡ଼ିଆ)' : targetLang);
    const prompt = `You are an expert audio transcription analyzer and editor.

The following text was generated by a user speaking into a microphone. The speaker's voice may not have been clear, was muffled, or the environment had background noise, resulting in phonetic errors, grammatical issues, or wrong words in the transcription.

Here are examples of how you should correct (train on) the input:
EXAMPLE 1:
- Spoken Language: "en-US"
- Target Language: "Odia"
- Raw Input: "we are learning art official and tell agents today"
- Output:
{
  "cleanedText": "We are learning artificial intelligence today",
  "translatedText": "ଆମେ ଆଜି କୃତ୍ରିମ ବୁଦ୍ଧିମତ୍ତା (Artificial Intelligence) ଶିଖୁଛୁ"
}

EXAMPLE 2:
- Spoken Language: "en-IN"
- Target Language: "Odia"
- Raw Input: "please open the soap and buy some milk"
- Output:
{
  "cleanedText": "Please open the shop and buy some milk",
  "translatedText": "ଦୟାକରି ଦୋକାନ ଖୋଲନ୍ତୁ ଏବଂ କିଛି କ୍ଷୀର କିଣନ୍ତୁ"
}

EXAMPLE 3:
- Spoken Language: "or-IN"
- Target Language: "Odia"
- Raw Input: "ମୁଁ କାଲି ଭୁବନେଶ୍ୱର ଯାଅଛି କାମ ଅଛି"
- Output:
{
  "cleanedText": "ମୁଁ କାଲି ଭୁବନେଶ୍ୱର ଯାଉଛି କାମ ଅଛି",
  "translatedText": "ମୁଁ କାଲି ଭୁବନେଶ୍ୱର ଯାଉଛି କାମ ଅଛି"
}

Now, process this real input:
Raw Speech Transcription: "${rawText}"
Spoken Language: "${sourceLang}"
Target Language: "${langLabel}"

Your task:
1. Intelligently analyze and clean this raw text. Guess the speaker's true intent based on phonetic similarity and contextual meaning of the phrases. Fix grammar, spelling, and sentence structures. Keep it in the spoken/source language.
2. Translate this corrected and cleaned speech text into the target language: ${langLabel}.

Respond strictly in JSON format matching this schema:
{
  "cleanedText": "The reconstructed/corrected original speech text in its source language",
  "translatedText": "The translation of the cleanedText into the target language"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
    const resJson = await res.json();
    const responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    const aiData = JSON.parse(responseText);

    return {
      cleanedText: aiData.cleanedText || rawText,
      translatedText: targetLang === 'or' ? sanitizeOdiaForPdf(aiData.translatedText) : aiData.translatedText
    };
  } catch (err) {
    console.error('[AI Mic Cleaner] Gemini API error, using fallback:', err.message);
    const translatedText = await translateSingleText(rawText, targetLang);
    return {
      cleanedText: rawText,
      translatedText
    };
  }
}

module.exports = {
  cleanInternalRepetitions,
  cleanRepetitionFallback,
  generateSummaryFallback,
  processContent,
  processMicSpeech
};

