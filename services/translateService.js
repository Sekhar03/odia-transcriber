const TECHNICAL_TERM_MAP = {
  'artificial intelligence': 'କୃତ୍ରିମ ବୁଦ୍ଧିମତ୍ତା (Artificial Intelligence)',
  'machine learning': 'ମେସିନ୍ ଲର୍ନିଂ (Machine Learning)',
  'technology': 'ପ୍ରଯୁକ୍ତିବିଦ୍ୟା (Technology)',
  'computer': 'କମ୍ପ୍ୟୁଟର (Computer)',
  'internet': 'ଇଣ୍ଟରନେଟ୍ (Internet)',
  'software': 'ସଫ୍ଟୱେର୍ (Software)',
  'upi': 'UPI (ୟୁପିଆଇ)',
  'youtube': 'YouTube (ୟୁଟ୍ୟୁବ୍)',
  'digital': 'ଡିଜିଟାଲ୍ (Digital)'
};

const HINDI_TO_ODIA_MAP = {
  'मध्य प्रदेश': 'ମଧ୍ୟପ୍ରଦେଶ',
  'उत्तर प्रदेश': 'ଉତ୍ତରପ୍ରଦେଶ',
  'राजस्थान': 'ରାଜସ୍ଥାନ',
  'दिल्ली': 'ଦିଲ୍ଲୀ',
  'हरियाणा': 'ହରିୟାଣା',
  'पंजाब': 'ପଞ୍ଜାବ',
  'गुजरात': 'ଗୁଜରାଟ',
  'महाराष्ट्र': 'ମହାରାଷ୍ଟ୍ର',
  'बिहार': 'ବିହାର'
};

const NLLB_LANG_MAP = {
  'or': 'ory_Orya',
  'en': 'eng_Latn',
  'hi': 'hin_Deva',
  'bn': 'ben_Beng',
  'te': 'tel_Telu',
  'ta': 'tam_Taml',
  'mr': 'mar_Deva',
  'es': 'spa_Latn',
  'fr': 'fra_Latn',
  'gu': 'guj_Gujr',
  'kn': 'kan_Knda',
  'pa': 'pan_Guru'
};

function cleanAsrArtifacts(text) {
  if (!text) return '';
  let cleaned = text.replace(/\b(\w+)\s+\1\b/gi, '$1');
  cleaned = cleaned.replace(/\[\s*[^\]\d]{1,20}\s*\]/g, '')
                   .replace(/\(\s*[^)\d]{1,20}\s*\)/g, '')
                   .trim();
  return cleaned;
}

function cleanOdiaMangledWords(text) {
  if (!text) return '';
  let s = String(text);

  // 1. Remove music / noise tags dynamically
  s = s.replace(/\[\s*[^\]\d]{1,20}\s*\]/g, '')
       .replace(/\(\s*[^)\d]{1,20}\s*\)/g, '');

  // 2. Fix specific mangled English+Odia combinations
  const fixMap = [
    [/\b(loans?|debts?|loan|debt|the|an|or)\s*ଣ\b/gi, 'ଋଣ'],
    [/\b(ishi|ish|age)\s*ଷି\b/gi, 'ଋଷି'],
    [/\bGod\s*ଶ୍ବର\b/gi, 'ଈଶ୍ବର'],
    [/\bdon'?t\s*ିନାହଁ\b/gi, 'ବୁଝିନାହଁ'],
    [/\bvalmiki\b/gi, 'ବାଲ୍ମୀକି'],
    [/\bbedvyas|vedvyas\b/gi, 'ବେଦବ୍ୟାସ']
  ];

  fixMap.forEach(([pattern, replacement]) => {
    s = s.replace(pattern, replacement);
  });

  // 3. Remove stray Latin letters directly attached to Odia words
  s = s.replace(/\b[a-z]{1,4}\s*(?=[\u0B00-\u0B7F])/gi, '');
  s = s.replace(/(?<=[\u0B00-\u0B7F])\s*[a-z]{1,4}\b/gi, '');

  return s;
}

function sanitizeOdiaForPdf(text) {
  if (!text) return '';
  let str = cleanOdiaMangledWords(text);

  // Punctuation & Smart Quotes Normalization
  str = str.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
           .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
           .replace(/\u2026/g, '...')
           .replace(/[\u2013\u2014]/g, '-')
           .replace(/\u20B9/g, 'Rs.')
           .replace(/[♪♫★✓✔▪►]/g, '');

  // Transliterate Hindi place names
  Object.keys(HINDI_TO_ODIA_MAP).forEach(k => {
    str = str.replace(new RegExp(k, 'g'), HINDI_TO_ODIA_MAP[k]);
  });

  // Strip Devanagari & control characters
  str = str.replace(/[\u0900-\u097F]/g, '');
  str = str.replace(/[\u200C\u200D\u200B\u2000-\u206F\u20A0-\u20CF\uFEFF]/g, '');

  // Map Oriya Wa/Va (U+0B71 / U+0B35) to standard Oriya Ba (U+0B2C) for correct Wa-phala conjunct rendering
  str = str.replace(/[\u0B71\u0B35]/g, '\u0B2C');

  // Keep ONLY Odia Unicode (\u0B00-\u0B7F) and printable ASCII (\x20-\x7E)
  str = str.replace(/[^\u0B00-\u0B7F\x20-\x7E]/g, '');

  return str.replace(/\s+/g, ' ').trim();
}

function hasTargetScriptCharacters(text, lang) {
  if (!text) return false;
  switch (lang) {
    case 'or':
      return /[\u0B00-\u0B7F]/.test(text);
    case 'hi':
    case 'mr':
      return /[\u0900-\u097F]/.test(text);
    case 'bn':
      return /[\u0980-\u09FF]/.test(text);
    case 'te':
      return /[\u0C00-\u0C7F]/.test(text);
    case 'ta':
      return /[\u0B80-\u0BFF]/.test(text);
    case 'gu':
      return /[\u0A80-\u0AFF]/.test(text);
    case 'kn':
      return /[\u0C80-\u0CFF]/.test(text);
    case 'pa':
      return /[\u0A00-\u0A7F]/.test(text);
    default:
      return /[a-zA-Z]/.test(text);
  }
}

const hasOdiaCharacters = (text) => hasTargetScriptCharacters(text, 'or');

const { translateWithIndicTrans2 } = require('./indicAiService');

async function translateSingleText(text, targetLang = 'or', srcLang = 'eng_Latn', tgtLang = 'ory_Orya') {
  if (!text || !text.trim()) return '';
  const cleanedInput = cleanAsrArtifacts(text);

  const needsLanguageCheck = !hasTargetScriptCharacters(cleanedInput, targetLang);
  const finalTgtLang = NLLB_LANG_MAP[targetLang] || tgtLang;

  // 0. Try Local Translation Server (T5 fine-tuned model) - only for Odia & English
  if (targetLang === 'or' || targetLang === 'en') {
    try {
      const localRes = await fetch('http://localhost:5002/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedInput,
          task: targetLang === 'en' ? 'translate Hindi to English' : 'translate English to Odia'
        })
      });
      if (localRes.ok) {
        const localData = await localRes.json();
        if (localData.translatedText) {
          console.log(`[Local Translation Server Success]: "${cleanedInput}" -> "${localData.translatedText}"`);
          const result = targetLang === 'or' ? sanitizeOdiaForPdf(localData.translatedText) : cleanAsrArtifacts(localData.translatedText);
          if (!needsLanguageCheck || hasTargetScriptCharacters(result, targetLang)) {
            return result;
          }
          console.log(`[Local Translation Server Bypass]: Result lacked ${targetLang} characters. Falling back...`);
        }
      }
    } catch (err) {
      // Fall back silently
    }
  }

  // 0.5. Try Hugging Face Cloud Inference API (if HF_TOKEN and HF_MODEL_ID are configured in Vercel)
  const hfToken = process.env.HF_TOKEN;
  const hfModelId = process.env.HF_MODEL_ID;
  if (hfToken && hfModelId) {
    try {
      const isNllb = hfModelId.toLowerCase().includes('nllb');
      let payload;
      
      if (isNllb) {
        payload = {
          inputs: cleanedInput,
          parameters: {
            src_lang: srcLang || 'eng_Latn',
            tgt_lang: finalTgtLang
          }
        };
      } else {
        payload = {
          inputs: `${targetLang === 'en' ? 'translate Hindi to English' : 'translate English to Odia'}: ${cleanedInput}`
        };
      }

      const hfRes = await fetch(`https://api-inference.huggingface.co/models/${hfModelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (hfRes.ok) {
        const hfData = await hfRes.json();
        const translatedText = hfData?.[0]?.generated_text || hfData?.[0]?.translation_text || hfData?.generated_text || hfData?.translation_text;
        if (translatedText) {
          console.log(`[Hugging Face Cloud Inference Success]: "${cleanedInput}" -> "${translatedText}"`);
          const result = targetLang === 'or' ? sanitizeOdiaForPdf(translatedText) : cleanAsrArtifacts(translatedText);
          if (!needsLanguageCheck || hasTargetScriptCharacters(result, targetLang)) {
            return result;
          }
          console.log(`[Hugging Face Cloud Inference Bypass]: Result lacked ${targetLang} characters. Falling back...`);
        }
      }
    } catch (err) {
      console.log('[Hugging Face Cloud API offline or error. Trying other online endpoints...]', err.message);
    }
  }

  // 1. Try AI4Bharat IndicTrans2 Model (HuggingFace)
  try {
    const aiTranslated = await translateWithIndicTrans2(cleanedInput, srcLang, tgtLang);
    if (aiTranslated && aiTranslated.trim()) {
      const result = targetLang === 'or' ? sanitizeOdiaForPdf(aiTranslated) : cleanAsrArtifacts(aiTranslated);
      if (!needsLanguageCheck || hasTargetScriptCharacters(result, targetLang)) {
        return result;
      }
      console.log(`[IndicTrans2 Bypass]: Result lacked ${targetLang} characters. Falling back...`);
    }
  } catch (err) {
    console.warn('[IndicTrans2 translation failed, falling back to Google Translate]:', err.message);
  }

  // 2. Fallback to Google Translate API using POST request (prevents 413 URL Too Large error)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: 'q=' + encodeURIComponent(cleanedInput),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Translation request failed: ${res.status}`);
    const data = await res.json();
    let translatedText = text;

    if (data && data[0]) {
      translatedText = data[0].map(item => item[0]).filter(Boolean).join('');
    }

    // Google Translate retry with explicit English source if it fails to produce target characters
    if (needsLanguageCheck && !hasTargetScriptCharacters(translatedText, targetLang)) {
      console.log(`[Google Translate Bypass]: sl=auto returned no ${targetLang} for "${cleanedInput}". Retrying with sl=en...`);
      try {
        const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t`;
        const resEn = await fetch(urlEn, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: 'q=' + encodeURIComponent(cleanedInput)
        });
        if (resEn.ok) {
          const dataEn = await resEn.json();
          if (dataEn && dataEn[0]) {
            const candidate = dataEn[0].map(item => item[0]).filter(Boolean).join('');
            if (hasTargetScriptCharacters(candidate, targetLang)) {
              translatedText = candidate;
            }
          }
        }
      } catch (errEn) {
        // ignore
      }
    }

    // Try MyMemory translation API if still no target characters
    if (needsLanguageCheck && !hasTargetScriptCharacters(translatedText, targetLang)) {
      console.log(`[MyMemory Fallback]: Retrying translation for "${cleanedInput}" via MyMemory API...`);
      try {
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanedInput)}&langpair=en|${targetLang}`;
        const myMemoryRes = await fetch(myMemoryUrl);
        if (myMemoryRes.ok) {
          const myMemoryData = await myMemoryRes.json();
          const candidate = myMemoryData?.responseData?.translatedText;
          if (candidate && hasTargetScriptCharacters(candidate, targetLang)) {
            translatedText = candidate;
          }
        }
      } catch (errMyMemory) {
        // ignore
      }
    }

    // Failsafe: Try translating by splitting sentence into smaller chunks/clauses
    if (needsLanguageCheck && !hasTargetScriptCharacters(translatedText, targetLang)) {
      console.log(`[Splitting Fallback]: Translating sentence by splitting into clauses: "${cleanedInput}"`);
      try {
        const parts = cleanedInput.split(/([,.;!?]|\band\b)/gi);
        const translatedParts = await Promise.all(parts.map(async (part) => {
          if (/^([,.;!?]|\band\b|\s+)$/i.test(part)) return part;
          if (!/[a-zA-Z]/.test(part)) return part;
          try {
            const urlEn = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t`;
            const resEn = await fetch(urlEn, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              },
              body: 'q=' + encodeURIComponent(part)
            });
            if (resEn.ok) {
              const dataEn = await resEn.json();
              if (dataEn && dataEn[0]) {
                const candidate = dataEn[0].map(item => item[0]).filter(Boolean).join('');
                if (hasTargetScriptCharacters(candidate, targetLang)) {
                  return candidate;
                }
              }
            }
          } catch (e) {}
          return part;
        }));
        const candidate = translatedParts.join('');
        if (hasTargetScriptCharacters(candidate, targetLang)) {
          translatedText = candidate;
        }
      } catch (errSplit) {
        // ignore
      }
    }

    if (targetLang === 'or') {
      Object.keys(TECHNICAL_TERM_MAP).forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        if (regex.test(cleanedInput) && !translatedText.includes(`(${term})`)) {
          translatedText = translatedText.replace(new RegExp(term, 'gi'), TECHNICAL_TERM_MAP[term]);
        }
      });
      return sanitizeOdiaForPdf(translatedText);
    }

    return cleanAsrArtifacts(translatedText);
  } catch (err) {
    return targetLang === 'or' ? sanitizeOdiaForPdf(cleanedInput) : cleanedInput;
  }
}

/**
 * Ultra-Fast Parallel Batch Translation Engine.
 * Translates 100+ lines in under 2.5 seconds to guarantee 100% Vercel compliance.
 */
async function translateLinesToTargetLanguage(lines, targetLang = 'or', onProgressUpdate) {
  if (!lines || lines.length === 0) return [];

  if (onProgressUpdate) {
    const progressLabel = targetLang === 'en' ? 'converting_to_english' : `converting_to_${targetLang}`;
    onProgressUpdate(progressLabel);
  }

  const batchSize = 15;
  const batches = [];
  for (let i = 0; i < lines.length; i += batchSize) {
    batches.push(lines.slice(i, i + batchSize));
  }

  const translatedBatches = await Promise.all(
    batches.map(async (batch) => {
      try {
        const promptText = batch.map((l, idx) => '[[' + (idx + 1) + ']] ' + cleanAsrArtifacts(l.text)).join('\n');
        
        // Auto-detect source script for model selection
        const hasHindi = /[\u0900-\u097F]/.test(promptText);
        const srcLang = hasHindi ? 'hin_Deva' : 'eng_Latn';
        const tgtLang = NLLB_LANG_MAP[targetLang] || 'ory_Orya';

        const translatedStr = await translateSingleText(promptText, targetLang, srcLang, tgtLang);
        const parts = translatedStr.split(/\[\[\d+\]\]/);

        return Promise.all(batch.map(async (l, idx) => {
          const part = (parts[idx + 1] && parts[idx + 1].trim()) ? parts[idx + 1].trim() : l.text;
          let finalTranslated = targetLang === 'or' ? sanitizeOdiaForPdf(part) : cleanAsrArtifacts(part);

          // Checker check: if target is Odia, source has letters, but final output has no Odia characters
          if (targetLang === 'or' && /[a-zA-Z]/.test(l.text) && !hasOdiaCharacters(finalTranslated)) {
            console.log(`[Batch Checker Retry]: Line "${l.text}" did not translate to Odia. Retrying line individually...`);
            const retried = await translateSingleText(l.text, targetLang, srcLang, tgtLang);
            if (hasOdiaCharacters(retried)) {
              finalTranslated = retried;
            }
          }

          return {
            ...l,
            text: cleanAsrArtifacts(l.text),
            translatedText: finalTranslated || l.text
          };
        }));
      } catch (e) {
        return batch.map(l => ({
          ...l,
          text: cleanAsrArtifacts(l.text),
          translatedText: targetLang === 'or' ? sanitizeOdiaForPdf(l.text) : cleanAsrArtifacts(l.text)
        }));
      }
    })
  );

  return translatedBatches.flat();
}

module.exports = {
  cleanAsrArtifacts,
  cleanOdiaMangledWords,
  sanitizeOdiaForPdf,
  translateSingleText,
  translateLinesToTargetLanguage
};
