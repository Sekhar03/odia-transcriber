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
  'बिहार': 'ବିହାର',
  'प्रशंसा': '',
  'संगीत': ''
};

function cleanAsrArtifacts(text) {
  if (!text) return '';
  let cleaned = text.replace(/\b(\w+)\s+\1\b/gi, '$1');
  cleaned = cleaned.replace(/\[\s*\]/g, '').trim();
  return cleaned;
}

function sanitizeOdiaForPdf(text) {
  if (!text) return '';
  let str = String(text);

  // Punctuation & Smart Quotes Normalization
  str = str.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
           .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
           .replace(/\u2026/g, '...')
           .replace(/[\u2013\u2014]/g, '-')
           .replace(/\u20B9/g, 'Rs.')
           .replace(/[♪♫★✓✔▪►]/g, '')
           .replace(/\|\|\|?/g, ' ');

  // Transliterate Hindi place names
  Object.keys(HINDI_TO_ODIA_MAP).forEach(k => {
    str = str.replace(new RegExp(k, 'g'), HINDI_TO_ODIA_MAP[k]);
  });

  // Strip Devanagari & control characters
  str = str.replace(/[\u0900-\u097F]/g, '');
  str = str.replace(/[\u2000-\u206F\u20A0-\u20CF\uFEFF]/g, '');

  // Keep ONLY Odia Unicode (\u0B00-\u0B7F) and printable ASCII (\x20-\x7E)
  str = str.replace(/[^\u0B00-\u0B7F\x20-\x7E]/g, '');

  return str.replace(/\s+/g, ' ').trim();
}

async function translateSingleText(text, targetLang = 'or') {
  if (!text || !text.trim()) return '';
  const cleanedInput = cleanAsrArtifacts(text);

  // If target language is English and text is already in English (ASCII), return clean input
  if (targetLang === 'en' && /^[\x00-\x7F\s.,!?:;()"-]+$/.test(cleanedInput)) {
    return cleanedInput;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=` + encodeURIComponent(cleanedInput);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!res.ok) throw new Error(`Translation request failed: ${res.status}`);
    const data = await res.json();
    let translatedText = text;

    if (data && data[0]) {
      translatedText = data[0].map(item => item[0]).filter(Boolean).join('');
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
    console.error('Translation error:', err.message);
    return targetLang === 'or' ? sanitizeOdiaForPdf(cleanedInput) : cleanedInput;
  }
}

async function translateLinesToTargetLanguage(lines, targetLang = 'or', onProgressUpdate) {
  if (!lines || lines.length === 0) return [];

  if (onProgressUpdate) onProgressUpdate(targetLang === 'en' ? 'converting_to_english' : 'converting_to_odia');

  const batchSize = 12;
  const chunks = [];
  for (let i = 0; i < lines.length; i += batchSize) {
    chunks.push({ startIndex: i, items: lines.slice(i, i + batchSize) });
  }

  const concurrency = 6;
  const translatedLines = [...lines];

  for (let i = 0; i < chunks.length; i += concurrency) {
    const activeGroup = chunks.slice(i, i + concurrency);
    await Promise.all(activeGroup.map(async (group) => {
      const joinedText = group.items.map(l => cleanAsrArtifacts(l.text).replace(/\|\|\|/g, '')).join(' ||| ');
      try {
        const translatedBatchStr = await translateSingleText(joinedText, targetLang);
        const parts = translatedBatchStr.split(/\s*\|\|\|\s*/);

        for (let j = 0; j < group.items.length; j++) {
          const lineIndex = group.startIndex + j;
          const translatedPart = (parts[j] && parts[j].trim()) ? parts[j].trim() : await translateSingleText(group.items[j].text, targetLang);
          
          translatedLines[lineIndex] = {
            ...translatedLines[lineIndex],
            text: cleanAsrArtifacts(group.items[j].text),
            translatedText: targetLang === 'or' ? sanitizeOdiaForPdf(translatedPart) : cleanAsrArtifacts(translatedPart)
          };
        }
      } catch (e) {
        for (let j = 0; j < group.items.length; j++) {
          const lineIndex = group.startIndex + j;
          const translatedPart = await translateSingleText(group.items[j].text, targetLang);
          translatedLines[lineIndex] = {
            ...translatedLines[lineIndex],
            text: cleanAsrArtifacts(group.items[j].text),
            translatedText: targetLang === 'or' ? sanitizeOdiaForPdf(translatedPart) : cleanAsrArtifacts(translatedPart)
          };
        }
      }
    }));
  }

  return translatedLines;
}

module.exports = {
  cleanAsrArtifacts,
  sanitizeOdiaForPdf,
  translateSingleText,
  translateLinesToTargetLanguage
};
