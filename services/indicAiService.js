/**
 * AI4Bharat Model Integration Layer
 * Speech-to-Text: ai4bharat/indic-conformer-600m-multilingual
 * English -> Odia: ai4bharat/indictrans2-en-indic-1B
 * Hindi/Indic -> Odia: ai4bharat/indictrans2-indic-indic-1B (or 320M dist)
 * GitHub: https://github.com/AI4Bharat/IndicTrans2
 */

const AI4BHARAT_CONFIG = {
  asrModel: 'ai4bharat/indic-conformer-600m-multilingual',
  enToOdiaModel: 'ai4bharat/indictrans2-en-indic-1B',
  indicToOdiaModel: 'ai4bharat/indictrans2-indic-indic-1B',
  indicToOdiaDistModel: 'ai4bharat/indictrans2-indic-indic-dist-320M',
  targetLanguage: 'ory_Orya', // IndicTrans2 language code for Odia
  sourceLangEn: 'eng_Latn',
  sourceLangHi: 'hin_Deva'
};

// HuggingFace Inference API helper for IndicTrans2 1B / IndicConformer
async function queryHuggingFaceModel(modelId, payload, apiKey = process.env.HF_TOKEN) {
  const url = `https://api-inference.huggingface.co/models/${modelId}`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`HF Model ${modelId} HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn(`[AI4Bharat HF Query] Warning for model ${modelId}:`, err.message);
    return null;
  }
}

/**
 * Translate using AI4Bharat IndicTrans2 1B model format
 */
async function translateWithIndicTrans2(text, srcLang = 'hin_Deva', tgtLang = 'ory_Orya') {
  if (!text || !text.trim()) return '';

  const payload = {
    inputs: text,
    parameters: {
      src_lang: srcLang,
      tgt_lang: tgtLang
    }
  };

  let modelId;
  if (tgtLang === 'eng_Latn') {
    modelId = 'ai4bharat/indictrans2-indic-en-1B';
  } else {
    modelId = srcLang === 'eng_Latn' 
      ? AI4BHARAT_CONFIG.enToOdiaModel 
      : AI4BHARAT_CONFIG.indicToOdiaModel;
  }

  const response = await queryHuggingFaceModel(modelId, payload);
  if (response && Array.isArray(response) && response[0]?.generated_text) {
    return response[0].generated_text;
  }
  if (response && response.translation_text) {
    return response.translation_text;
  }

  // Fallback to distilled/smaller model if 1B fails or is rate-limited
  if (tgtLang === 'eng_Latn') {
    const fallbackModel = 'ai4bharat/indictrans2-indic-en-dist-200M';
    const fallbackResponse = await queryHuggingFaceModel(fallbackModel, payload);
    if (fallbackResponse && Array.isArray(fallbackResponse) && fallbackResponse[0]?.generated_text) {
      return fallbackResponse[0].generated_text;
    }
  }

  return null; // fallback to primary translation engine if HF key/local server not active
}

module.exports = {
  AI4BHARAT_CONFIG,
  queryHuggingFaceModel,
  translateWithIndicTrans2
};
