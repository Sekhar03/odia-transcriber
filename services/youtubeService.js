const { YoutubeTranscript } = require('youtube-transcript');
const he = require('he');

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2Slv5QZ0_A9-x_M4_J8-M';

function extractVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const padMins = String(mins).padStart(2, '0');
  const padSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    const padHrs = String(hrs).padStart(2, '0');
    return `${padHrs}:${padMins}:${padSecs}`;
  }
  return `${padMins}:${padSecs}`;
}

function vercelCustomFetch(url, options = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Cookie': 'SOCS=CAESEwgDEgk2ODE3ODc5OTAaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+667',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    ...(options.headers || {})
  };

  return fetch(url, { ...options, headers });
}

function parseUniversalCaptions(rawContent, lang = 'en') {
  if (!rawContent || !rawContent.trim()) return [];
  const results = [];

  // 1. JSON3 format parsing
  if (rawContent.trim().startsWith('{')) {
    try {
      const data = JSON.parse(rawContent);
      if (data?.events) {
        for (const evt of data.events) {
          if (evt.segs && evt.segs.length > 0) {
            const textStr = evt.segs.map(s => s.utf8).join('').trim();
            const cleanText = he.decode(textStr);
            if (cleanText && cleanText !== '\n') {
              results.push({
                text: cleanText,
                offset: evt.tStartMs || 0,
                duration: evt.dDurationMs || 3000,
                lang
              });
            }
          }
        }
      }
      if (results.length > 0) return results;
    } catch (e) {}
  }

  // 2. YoutubeTranscript XML parser
  try {
    const ytParsed = YoutubeTranscript.parseTranscriptXml(rawContent, lang);
    if (ytParsed && ytParsed.length > 0) return ytParsed;
  } catch (e) {}

  // 3. srv3 format (<p t="ms" d="ms">...)
  const pMatches = rawContent.matchAll(/<p\s+[^>]*t=["']?(\d+)["']?[^>]*>(.*?)<\/p>/gi);
  for (const m of pMatches) {
    const startMs = parseInt(m[1], 10);
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    const cleanText = he.decode(inner);
    if (cleanText) {
      results.push({
        text: cleanText,
        offset: startMs,
        duration: 3000,
        lang
      });
    }
  }
  if (results.length > 0) return results;

  // 4. Classic XML format (<text start="...">...)
  const textMatches = rawContent.matchAll(/<text\s+[^>]*start=["']?([\d\.]+)["']?[^>]*>(.*?)<\/text>/gi);
  for (const m of textMatches) {
    const startSec = parseFloat(m[1]);
    const startMs = startSec > 1000 ? startSec : startSec * 1000;
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    const cleanText = he.decode(inner);
    if (cleanText) {
      results.push({
        text: cleanText,
        offset: startMs,
        duration: 3000,
        lang
      });
    }
  }

  return results;
}

function findCaptionTracksInResponse(data) {
  if (!data) return null;
  if (data?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
    return data.captions.playerCaptionsTracklistRenderer.captionTracks;
  }
  if (data?.captions?.playerCaptionsRenderer?.captionTracks) {
    return data.captions.playerCaptionsRenderer.captionTracks;
  }

  let found = null;
  function searchObj(obj, depth = 0) {
    if (!obj || depth > 6 || found) return;
    if (typeof obj === 'object') {
      if (Array.isArray(obj.captionTracks) && obj.captionTracks.length > 0) {
        found = obj.captionTracks;
        return;
      }
      for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
          searchObj(obj[k], depth + 1);
        }
      }
    }
  }
  searchObj(data);
  return found;
}

/**
 * Universal Mobile InnerTube Extractor with Diagnostic Logs.
 */
async function fetchViaInnerTube(videoId, debugLogs = []) {
  const clientConfigs = [
    {
      name: 'ANDROID',
      url: `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      clientVersion: '20.10.38',
      clientName: 'ANDROID'
    },
    {
      name: 'ANDROID_TESTSUITE',
      url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
      clientVersion: '20.10.38',
      clientName: 'ANDROID'
    }
  ];

  for (const config of clientConfigs) {
    try {
      debugLogs.push(`[InnerTube] Trying client ${config.name} at ${config.url}`);
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': config.userAgent,
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': config.clientVersion
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: config.clientName,
              clientVersion: config.clientVersion
            }
          },
          videoId: videoId
        })
      });

      if (!res.ok) {
        debugLogs.push(`[InnerTube] Client ${config.name} HTTP error: ${res.status}`);
        continue;
      }
      const data = await res.json();

      const playability = data?.playabilityStatus?.status;
      const title = data?.videoDetails?.title || '';
      const author = data?.videoDetails?.author || '';
      const lengthSeconds = parseInt(data?.videoDetails?.lengthSeconds || '0', 10);

      const captionTracks = findCaptionTracksInResponse(data);
      debugLogs.push(`[InnerTube] Client ${config.name} Playability: ${playability} | CaptionTracks count: ${captionTracks ? captionTracks.length : 0}`);

      if (!captionTracks || captionTracks.length === 0) continue;

      const sortedTracks = [...captionTracks].sort((a, b) => {
        const langA = (a.languageCode || '').toLowerCase();
        const langB = (b.languageCode || '').toLowerCase();
        const isPriorityA = langA.startsWith('hi') || langA.startsWith('en') || langA.startsWith('or');
        const isPriorityB = langB.startsWith('hi') || langB.startsWith('en') || langB.startsWith('or');
        if (isPriorityA && !isPriorityB) return -1;
        if (!isPriorityA && isPriorityB) return 1;
        return 0;
      });

      for (const track of sortedTracks) {
        if (!track.baseUrl) continue;
        try {
          debugLogs.push(`[InnerTube] Fetching track baseUrl for lang ${track.languageCode}`);
          const trackRes = await fetch(track.baseUrl, {
            headers: {
              'User-Agent': config.userAgent
            }
          });
          if (!trackRes.ok) {
            debugLogs.push(`[InnerTube Track] Fetch track HTTP error: ${trackRes.status}`);
            continue;
          }
          const xmlText = await trackRes.text();
          debugLogs.push(`[InnerTube Track] XmlText length: ${xmlText ? xmlText.length : 0}`);
          if (!xmlText || xmlText.length === 0) continue;

          const parsed = parseUniversalCaptions(xmlText, track.languageCode);
          debugLogs.push(`[InnerTube Track] Parsed items count: ${parsed ? parsed.length : 0}`);
          if (parsed && parsed.length > 0) {
            debugLogs.push(`[InnerTube SUCCESS] Extracted ${parsed.length} items using client ${config.name}`);
            return {
              rawItems: parsed,
              title,
              author,
              lengthSeconds
            };
          }
        } catch (e) {
          debugLogs.push(`[InnerTube Track Error] ${e.message}`);
        }
      }
    } catch (err) {
      debugLogs.push(`[InnerTube Client Error] ${config.name}: ${err.message}`);
    }
  }

  return null;
}

function detectSpokenLanguage(textSample) {
  const hindiRegex = /[\u0900-\u097F]/;
  const englishRegex = /[a-zA-Z]/;

  const hasHindi = hindiRegex.test(textSample);
  const hasEnglish = englishRegex.test(textSample);

  if (hasHindi && hasEnglish) return 'Hindi + English (Hinglish Mixed)';
  if (hasHindi) return 'Hindi (हिन्दी)';
  if (hasEnglish) return 'English';
  return 'English / Hindi';
}

function assignSpeakers(rawLines) {
  let currentSpeaker = 1;
  let linesWithSpeakers = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const prevLine = i > 0 ? rawLines[i - 1] : null;

    let switchSpeaker = false;
    if (prevLine) {
      const gap = line.start - prevLine.end;
      const prevEndsWithQuestion = prevLine.text.trim().endsWith('?');
      const startsWithAnswerMarker = /^(yes|yeah|haan|ji|right|exactly|no|nahi|accha|sure|well|so|look|listen)\b/i.test(line.text.trim());

      if (gap > 2.8 || (prevEndsWithQuestion && startsWithAnswerMarker)) {
        switchSpeaker = true;
      }
    }

    if (switchSpeaker) {
      currentSpeaker = currentSpeaker === 1 ? 2 : 1;
    }

    linesWithSpeakers.push({
      ...line,
      speaker: `Speaker ${currentSpeaker}`
    });
  }

  return linesWithSpeakers;
}

async function getYouTubeMetadata(videoId) {
  const pageUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = 'YouTube Video';
  let author = 'YouTube Channel';
  let lengthSeconds = 0;
  let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const response = await vercelCustomFetch(pageUrl);
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
      if (titleMatch) title = he.decode(titleMatch[1]);

      const authorMatch = html.match(/<link itemprop="name" content="([^"]+)">/);
      if (authorMatch) author = he.decode(authorMatch[1]);
    }
  } catch (e) {
    console.error('Metadata fetch warning:', e.message);
  }

  return {
    videoId,
    title,
    author,
    lengthSeconds,
    durationFormatted: formatTime(lengthSeconds),
    thumbnail,
    url: pageUrl
  };
}

async function getYouTubeData(url, onProgressUpdate, debugLogs = []) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please paste a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=...)');
  }

  debugLogs.push(`[getYouTubeData] Extracted videoId: ${videoId}`);
  if (onProgressUpdate) onProgressUpdate('video_detected');

  const metadata = await getYouTubeMetadata(videoId);
  if (onProgressUpdate) onProgressUpdate('audio_extracted');

  let rawItems = [];
  let sourceLanguage = 'English / Hindi';

  // ===== LAYER 1: YoutubeTranscript library with NATIVE fetch (no custom wrapper) =====
  // This is the most reliable method because the library handles YouTube's
  // session cookies and consent internally. Works from most cloud IPs.
  const langAttempts = [undefined, 'hi', 'en'];
  for (const lang of langAttempts) {
    if (rawItems.length > 0) break;
    try {
      const opts = lang ? { lang } : {};
      debugLogs.push(`[Layer 1] YoutubeTranscript.fetchTranscript (native fetch, lang=${lang || 'auto'})...`);
      rawItems = await YoutubeTranscript.fetchTranscript(videoId, opts);
      if (rawItems && rawItems.length > 0) {
        debugLogs.push(`[Layer 1 SUCCESS] Extracted ${rawItems.length} items with lang=${lang || 'auto'}`);
      }
    } catch (e1) {
      debugLogs.push(`[Layer 1] lang=${lang || 'auto'} failed: ${e1.message}`);
    }
  }

  // ===== LAYER 2: YoutubeTranscript with custom fetch wrapper (SOCS cookies) =====
  if (!rawItems || rawItems.length === 0) {
    for (const lang of langAttempts) {
      if (rawItems && rawItems.length > 0) break;
      try {
        const opts = lang ? { lang, fetch: vercelCustomFetch } : { fetch: vercelCustomFetch };
        debugLogs.push(`[Layer 2] YoutubeTranscript.fetchTranscript (custom fetch, lang=${lang || 'auto'})...`);
        rawItems = await YoutubeTranscript.fetchTranscript(videoId, opts);
        if (rawItems && rawItems.length > 0) {
          debugLogs.push(`[Layer 2 SUCCESS] Extracted ${rawItems.length} items with lang=${lang || 'auto'}`);
        }
      } catch (e2) {
        debugLogs.push(`[Layer 2] lang=${lang || 'auto'} failed: ${e2.message}`);
      }
    }
  }

  // ===== LAYER 3: InnerTube ANDROID Multi-Client Extractor =====
  if (!rawItems || rawItems.length === 0) {
    debugLogs.push(`[Layer 3] Trying InnerTube ANDROID Multi-Client...`);
    const innerTubeRes = await fetchViaInnerTube(videoId, debugLogs);
    if (innerTubeRes && innerTubeRes.rawItems && innerTubeRes.rawItems.length > 0) {
      rawItems = innerTubeRes.rawItems;
      if (innerTubeRes.title) metadata.title = innerTubeRes.title;
      if (innerTubeRes.author) metadata.author = innerTubeRes.author;
      if (innerTubeRes.lengthSeconds) {
        metadata.lengthSeconds = innerTubeRes.lengthSeconds;
        metadata.durationFormatted = formatTime(innerTubeRes.lengthSeconds);
      }
    }
  }

  // ===== LAYER 4: Watch Page HTML Scraping =====
  if (!rawItems || rawItems.length === 0) {
    debugLogs.push(`[Layer 4] Trying Watch Page HTML Scraping...`);
    try {
      const watchRes = await vercelCustomFetch(`https://www.youtube.com/watch?v=${videoId}`);
      const watchHtml = await watchRes.text();
      const match = watchHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s);
      if (match) {
        const pData = JSON.parse(match[1]);
        const captionTracks = findCaptionTracksInResponse(pData);
        debugLogs.push(`[Layer 4] CaptionTracks count: ${captionTracks ? captionTracks.length : 0}`);
        if (captionTracks && captionTracks.length > 0) {
          for (const tr of captionTracks) {
            if (!tr.baseUrl) continue;
            const trRes = await vercelCustomFetch(tr.baseUrl);
            const txtData = await trRes.text();
            if (txtData && txtData.length > 0) {
              const parsed = parseUniversalCaptions(txtData, tr.languageCode);
              if (parsed && parsed.length > 0) {
                rawItems = parsed;
                debugLogs.push(`[Layer 4 SUCCESS] Extracted ${parsed.length} items`);
                break;
              }
            }
          }
        }
      }
    } catch (e4) {
      debugLogs.push(`[Layer 4 Error] ${e4.message}`);
    }
  }

  // ===== LAYER 5: Direct TimedText Endpoints =====
  if (!rawItems || rawItems.length === 0) {
    debugLogs.push(`[Layer 5] Trying Direct TimedText Endpoints...`);
    const fallbacks = ['hi', 'en', 'or', 'a.hi', 'a.en'];
    for (const fLang of fallbacks) {
      try {
        const directRes = await vercelCustomFetch(`https://www.youtube.com/api/timedtext?v=${videoId}&lang=${fLang}&fmt=srv1`);
        const directTxt = await directRes.text();
        if (directTxt && directTxt.length > 0) {
          const parsed = parseUniversalCaptions(directTxt, fLang);
          if (parsed && parsed.length > 0) {
            rawItems = parsed;
            debugLogs.push(`[Layer 5 SUCCESS] Extracted ${parsed.length} items for lang ${fLang}`);
            break;
          }
        }
      } catch (e5) {}
    }
  }

  if (!rawItems || rawItems.length === 0) {
    debugLogs.push(`[getYouTubeData Error] ALL 5 LAYERS FAILED for videoId: ${videoId}`);
    throw new Error(`Could not extract captions for video ID (${videoId}). Please check if the video has captions/subtitles enabled on YouTube.`);
  }

  // If InnerTube provided metadata, update it
  if (!metadata.title || metadata.title === 'YouTube Video') {
    const innerTubeRes = await fetchViaInnerTube(videoId, []);
    if (innerTubeRes) {
      if (innerTubeRes.title) metadata.title = innerTubeRes.title;
      if (innerTubeRes.author) metadata.author = innerTubeRes.author;
      if (innerTubeRes.lengthSeconds) {
        metadata.lengthSeconds = innerTubeRes.lengthSeconds;
        metadata.durationFormatted = formatTime(innerTubeRes.lengthSeconds);
      }
    }
  }

  if (onProgressUpdate) onProgressUpdate('speech_detected');

  if (!rawItems || rawItems.length === 0) {
    throw new Error(`No spoken dialogue lines found for video ID (${videoId}).`);
  }

  // Detect spoken language & code-switching
  const fullTextSample = rawItems.slice(0, 15).map(i => i.text).join(' ');
  sourceLanguage = detectSpokenLanguage(fullTextSample);

  // Parse raw lines
  const parsedLines = rawItems.map(item => {
    const startSec = (item.offset || 0) / 1000;
    const durSec = (item.duration || 3000) / 1000;
    const endSec = startSec + durSec;
    const cleanText = he.decode(item.text || '').replace(/\n/g, ' ').trim();

    return {
      start: startSec,
      end: endSec,
      duration: durSec,
      startFormatted: formatTime(startSec),
      endFormatted: formatTime(endSec),
      text: cleanText
    };
  }).filter(l => l.text && l.text !== '[Music]' && l.text !== '[♪♪♪]' && l.text !== '[ମ୍ୟୁଜିକ୍]' && l.text !== '[ସଙ୍ଗୀତ]');

  // Group adjacent short lines into natural conversational turns
  const mergedLines = [];
  let currentGroup = null;

  for (const line of parsedLines) {
    if (!currentGroup) {
      currentGroup = { ...line };
    } else if (
      currentGroup.text.length + line.text.length < 130 &&
      line.start - currentGroup.end < 2.5
    ) {
      currentGroup.text += ' ' + line.text;
      currentGroup.end = line.end;
      currentGroup.endFormatted = formatTime(line.end);
      currentGroup.duration = currentGroup.end - currentGroup.start;
    } else {
      mergedLines.push(currentGroup);
      currentGroup = { ...line };
    }
  }
  if (currentGroup) mergedLines.push(currentGroup);

  // Perform Speaker Diarization
  const linesWithSpeakers = assignSpeakers(mergedLines);

  const linesWithId = linesWithSpeakers.map((l, index) => ({
    id: index + 1,
    ...l
  }));

  if (linesWithId.length > 0) {
    metadata.lengthSeconds = Math.ceil(linesWithId[linesWithId.length - 1].end);
    metadata.durationFormatted = formatTime(metadata.lengthSeconds);
  }

  if (onProgressUpdate) onProgressUpdate('transcript_generated');

  return {
    metadata,
    sourceLanguage,
    lines: linesWithId
  };
}

module.exports = {
  extractVideoId,
  formatTime,
  getYouTubeData
};
