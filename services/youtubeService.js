const { YoutubeTranscript } = require('youtube-transcript');
const he = require('he');

const INNERTUBE_API_KEY = process.env.INNERTUBE_API_KEY || 'AIzaSyAO_FJ2Slv5QZ0_A9-x_M4_J8-M';
const FETCH_TIMEOUT_MS = 12000;

const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)';
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const FALLBACK_INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.f5.si',
  'https://yt.artemislena.eu',
  'https://invidious.protokolla.fi',
  'https://invidious.privacyredirect.com',
  'https://invidious.dhusch.de'
];

function getInnerTubeClients(apiKey = INNERTUBE_API_KEY) {
  const playerUrl = (key) => `https://www.youtube.com/youtubei/v1/player?key=${key}`;

  return [
    {
      name: 'ANDROID',
      url: playerUrl(apiKey),
      userAgent: ANDROID_UA,
      clientVersion: '20.10.38',
      clientName: 'ANDROID',
      clientId: '3',
      clientExtras: { androidSdkVersion: 34, osName: 'Android', osVersion: '14' }
    },
    {
      name: 'ANDROID_EMBEDDED',
      url: playerUrl(apiKey),
      userAgent: ANDROID_UA,
      clientVersion: '20.10.38',
      clientName: 'ANDROID_EMBEDDED',
      clientId: '55',
      contextExtras: (videoId) => ({
        thirdParty: { embedUrl: `https://www.youtube.com/embed/${videoId}` }
      })
    },
    {
      name: 'IOS',
      url: playerUrl(apiKey),
      userAgent: 'com.google.ios.youtube/20.10.38 (iPhone14,3; U; CPU iOS 17_0 like Mac OS X)',
      clientVersion: '20.10.38',
      clientName: 'IOS',
      clientId: '5'
    },
    {
      name: 'TV_EMBEDDED',
      url: playerUrl(apiKey),
      userAgent: 'Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version',
      clientVersion: '2.0',
      clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      clientId: '85',
      clientExtras: { clientScreen: 'EMBED', androidSdkVersion: 30 },
      contextExtras: (videoId) => ({
        thirdParty: { embedUrl: `https://www.youtube.com/embed/${videoId}` }
      })
    },
    {
      name: 'MWEB',
      url: playerUrl(apiKey),
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      clientVersion: '2.20250205.01.00',
      clientName: 'MWEB',
      clientId: '2'
    },
    {
      name: 'WEB',
      url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      userAgent: WEB_UA,
      clientVersion: '2.20250205.01.00',
      clientName: 'WEB',
      clientId: '1',
      clientExtras: { clientScreen: 'WATCH' }
    }
  ];
}

const YOUTUBE_FETCH_PROFILES = [
  {
    name: 'android',
    headers: {
      'User-Agent': ANDROID_UA,
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Accept': '*/*',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    }
  },
  {
    name: 'web-consent',
    headers: {
      'User-Agent': WEB_UA,
      'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
      'Cookie': 'SOCS=CAESEwgDEgk2ODE3ODc5OTAaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+667',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com'
    }
  }
];

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

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function youtubeFetch(url, profile, options = {}) {
  return fetchWithTimeout(url, {
    ...options,
    headers: {
      ...(profile?.headers || {}),
      ...(options.headers || {})
    }
  });
}

function parseUniversalCaptions(rawContent, lang = 'en') {
  if (!rawContent || !rawContent.trim()) return [];
  const results = [];

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

  try {
    const ytParsed = YoutubeTranscript.parseTranscriptXml(rawContent, lang);
    if (ytParsed && ytParsed.length > 0) return ytParsed;
  } catch (e) {}

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

function sortCaptionTracks(tracks, getLang) {
  return [...tracks].sort((a, b) => {
    const langA = (getLang(a) || '').toLowerCase();
    const langB = (getLang(b) || '').toLowerCase();
    const isPriorityA = langA.startsWith('hi') || langA.startsWith('en') || langA.startsWith('or');
    const isPriorityB = langB.startsWith('hi') || langB.startsWith('en') || langB.startsWith('or');
    if (isPriorityA && !isPriorityB) return -1;
    if (!isPriorityA && isPriorityB) return 1;
    return 0;
  });
}

function transcriptSegmentsToRawItems(segments, lang) {
  if (!segments?.length) return [];

  return segments.map(item => {
    const startMs = item.start_ms ?? item.startMs ?? ((item.start_time ?? item.startTime ?? 0) * 1000);
    const endMs = item.end_ms ?? item.endMs ?? ((item.end_time ?? item.endTime ?? 0) * 1000);
    const duration = endMs > startMs ? endMs - startMs : (item.duration ?? 3000);

    return {
      text: item.snippet?.text || item.text || '',
      offset: startMs,
      duration,
      lang
    };
  }).filter(item => item.text);
}

function buildCaptionUrls(baseUrl) {
  const cleanBase = baseUrl.replace(/&fmt=[^&]+/g, '');
  return [
    `${cleanBase}&fmt=srv3`,
    `${cleanBase}&fmt=json3`,
    `${cleanBase}&fmt=srv1`,
    cleanBase
  ];
}

function buildInnerTubeRequestBody(config, videoId) {
  return {
    context: {
      client: {
        clientName: config.clientName,
        clientVersion: config.clientVersion,
        hl: 'en',
        gl: 'US',
        ...(config.clientExtras || {})
      },
      ...(config.contextExtras ? config.contextExtras(videoId) : {})
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true
  };
}

async function extractInnertubeApiKey(videoId, debugLogs = []) {
  try {
    const res = await youtubeFetch(`https://www.youtube.com/watch?v=${videoId}`, YOUTUBE_FETCH_PROFILES[1]);
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)
      || html.match(/INNERTUBE_API_KEY['"]\s*:\s*['"]([^'"]+)['"]/);

    if (match?.[1]) {
      debugLogs.push('[InnerTube] Extracted fresh INNERTUBE_API_KEY from watch page');
      return match[1];
    }
  } catch (e) {
    debugLogs.push(`[InnerTube] API key extraction failed: ${e.message}`);
  }

  return null;
}

function parseVttTimestamp(value) {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseWebVTT(content, lang = 'en') {
  if (!content?.trim()) return [];

  const results = [];
  const blocks = content.replace(/\r/g, '').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (!lines.length || lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE')) continue;

    const idx = lines.findIndex(line => line.includes('-->'));
    if (idx === -1) continue;

    const [startRaw, endRaw] = lines[idx].split('-->').map(part => part.trim().split(' ')[0]);
    const text = lines.slice(idx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    const startSec = parseVttTimestamp(startRaw);
    const endSec = parseVttTimestamp(endRaw);

    results.push({
      text: he.decode(text),
      offset: startSec * 1000,
      duration: Math.max((endSec - startSec) * 1000, 500),
      lang
    });
  }

  return results;
}

async function getInvidiousInstances() {
  try {
    const res = await fetchWithTimeout('https://api.invidious.io/instances.json?sort_by=health', {}, 8000);
    if (!res.ok) return FALLBACK_INVIDIOUS_INSTANCES;

    const data = await res.json();
    const instances = data
      .filter(([, meta]) => meta?.type === 'https')
      .slice(0, 10)
      .map(([uri]) => `https://${String(uri).replace(/^https?:\/\//, '')}`);

    return instances.length ? instances : FALLBACK_INVIDIOUS_INSTANCES;
  } catch (e) {
    return FALLBACK_INVIDIOUS_INSTANCES;
  }
}

async function fetchViaInvidious(videoId, debugLogs = []) {
  debugLogs.push('[Invidious] Trying public Invidious instances for cloud IP fallback...');
  const instances = await getInvidiousInstances();

  for (const base of instances) {
    try {
      const listRes = await fetchWithTimeout(`${base}/api/v1/captions/${videoId}`, {
        headers: { 'User-Agent': WEB_UA, Accept: 'application/json' }
      }, 8000);

      if (!listRes.ok) {
        debugLogs.push(`[Invidious] ${base} list HTTP ${listRes.status}`);
        continue;
      }

      const payload = await listRes.json();
      const captions = payload.captions || [];
      debugLogs.push(`[Invidious] ${base} tracks=${captions.length}`);
      if (!captions.length) continue;

      const preferred = captions.find(c => /^hi/i.test(c.languageCode || c.label || ''))
        || captions.find(c => /^en/i.test(c.languageCode || c.label || ''))
        || captions[0];

      const captionPath = preferred.url
        || `/api/v1/captions/${videoId}?label=${encodeURIComponent(preferred.label)}`;
      const captionUrl = captionPath.startsWith('http') ? captionPath : `${base}${captionPath}`;

      const capRes = await fetchWithTimeout(captionUrl, {
        headers: { 'User-Agent': WEB_UA, Accept: 'text/vtt,text/plain,*/*' }
      }, 10000);

      if (!capRes.ok) continue;

      const body = await capRes.text();
      const lang = preferred.languageCode || 'en';
      let parsed = parseWebVTT(body, lang);
      if (!parsed.length) parsed = parseUniversalCaptions(body, lang);

      if (parsed.length) {
        debugLogs.push(`[Invidious] SUCCESS ${parsed.length} captions via ${base}`);
        return { rawItems: parsed };
      }
    } catch (e) {
      debugLogs.push(`[Invidious] ${base} failed: ${e.message}`);
    }
  }

  return null;
}

async function fetchCaptionTrackBody(baseUrl, profile) {
  for (const url of buildCaptionUrls(baseUrl)) {
    try {
      const trackRes = await youtubeFetch(url, profile);
      if (!trackRes.ok) continue;

      const body = await trackRes.text();
      if (body && body.trim()) {
        return body;
      }
    } catch (e) {}
  }

  return null;
}

async function tryInnerTubeClient(config, videoId, debugLogs = []) {
  const res = await fetchWithTimeout(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': config.userAgent,
      'X-YouTube-Client-Name': config.clientId,
      'X-YouTube-Client-Version': config.clientVersion
    },
    body: JSON.stringify(buildInnerTubeRequestBody(config, videoId))
  });

  if (!res.ok) {
    debugLogs.push(`[InnerTube:${config.name}] HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const playability = data?.playabilityStatus?.status;
  const captionTracks = findCaptionTracksInResponse(data);
  debugLogs.push(`[InnerTube:${config.name}] playability=${playability} tracks=${captionTracks?.length || 0}`);

  if (playability === 'LOGIN_REQUIRED') {
    return null;
  }

  if (!captionTracks?.length) return null;

  const profile = { name: config.name, headers: {
    'User-Agent': config.userAgent,
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    'Accept': '*/*',
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com'
  }};

  const sortedTracks = sortCaptionTracks(captionTracks, track => track.languageCode);

  for (const track of sortedTracks) {
    if (!track.baseUrl) continue;

    const body = await fetchCaptionTrackBody(track.baseUrl, profile);
    if (!body) continue;

    const parsed = parseUniversalCaptions(body, track.languageCode);
    if (parsed?.length) {
      debugLogs.push(`[InnerTube:${config.name}] SUCCESS ${parsed.length} captions (${track.languageCode})`);
      return {
        rawItems: parsed,
        title: data?.videoDetails?.title || '',
        author: data?.videoDetails?.author || '',
        lengthSeconds: parseInt(data?.videoDetails?.lengthSeconds || '0', 10)
      };
    }
  }

  return null;
}

/**
 * InnerTube multi-client extractor — direct server-side calls, no proxies.
 */
async function fetchViaInnerTube(videoId, debugLogs = []) {
  debugLogs.push('[InnerTube] Trying direct InnerTube clients...');

  let apiKey = INNERTUBE_API_KEY;
  const extractedKey = await extractInnertubeApiKey(videoId, debugLogs);
  if (extractedKey) apiKey = extractedKey;

  const clients = getInnerTubeClients(apiKey);

  for (const config of clients) {
    try {
      const result = await tryInnerTubeClient(config, videoId, debugLogs);
      if (result?.rawItems?.length) return result;
    } catch (err) {
      debugLogs.push(`[InnerTube:${config.name}] ${err.message}`);
    }
  }

  return null;
}

/**
 * youtubei.js — direct InnerTube library, no third-party proxies.
 */
async function fetchViaYoutubeiJS(videoId, debugLogs = []) {
  try {
    debugLogs.push('[youtubei.js] Initializing Innertube...');
    const { Innertube, ClientType } = await import('youtubei.js');
    const clientTypes = [ClientType.ANDROID, ClientType.TV_EMBEDDED, ClientType.IOS];

    for (const clientType of clientTypes) {
      try {
        debugLogs.push(`[youtubei.js] Trying client ${clientType}...`);
        const innertube = await Innertube.create({
          client_type: clientType,
          retrieve_player: false,
          generate_session_locally: true
        });
        let captionTracks = [];
        let title = '';
        let author = '';
        let lengthSeconds = 0;
        let info = null;

        try {
          const playerRes = await innertube.actions.execute('/player', { videoId, client: clientType });
          captionTracks = playerRes.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          title = playerRes.videoDetails?.title || '';
          author = playerRes.videoDetails?.author || '';
          lengthSeconds = parseInt(playerRes.videoDetails?.lengthSeconds || '0');
        } catch (playerErr) {
          debugLogs.push(`[youtubei.js] Direct player actions failed: ${playerErr.message}. Trying getInfo fallback...`);
          info = await innertube.getInfo(videoId);
          captionTracks = info.captions?.caption_tracks;
          title = info.basic_info?.title || '';
          author = info.basic_info?.author || '';
          lengthSeconds = info.basic_info?.duration || 0;
        }

        debugLogs.push(`[youtubei.js] ${clientType} caption tracks=${captionTracks?.length || 0}`);

        if (captionTracks?.length) {
          const sortedTracks = sortCaptionTracks(captionTracks, track => track.language_code || track.languageCode);

          for (const track of sortedTracks) {
            const baseUrl = track.base_url || track.baseUrl;
            if (!baseUrl) continue;

            const body = await fetchCaptionTrackBody(baseUrl, YOUTUBE_FETCH_PROFILES[0]);
            const parsed = parseUniversalCaptions(body, track.language_code || track.languageCode);
            if (parsed?.length) {
              debugLogs.push(`[youtubei.js] SUCCESS ${parsed.length} captions via base_url`);
              return {
                rawItems: parsed,
                title: title,
                author: author,
                lengthSeconds: lengthSeconds
              };
            }
          }
        }

        if (!info) {
          try {
            info = await innertube.getInfo(videoId);
          } catch (e) {
            // ignore
          }
        }

        if (info) {
          try {
            const transcript = await info.getTranscript();
            const segments = transcript?.transcript?.content?.body?.initial_segments
              || transcript?.content?.body?.initial_segments
              || transcript?.segments
              || [];
            const rawItems = transcriptSegmentsToRawItems(segments, 'en');

            if (rawItems.length) {
              debugLogs.push(`[youtubei.js] SUCCESS ${rawItems.length} captions via getTranscript`);
              return {
                rawItems,
                title: info.basic_info?.title || '',
                author: info.basic_info?.author || '',
                lengthSeconds: info.basic_info?.duration || 0
              };
            }
          } catch (transcriptErr) {
            // ignore
          }
        }
      } catch (e) {
        debugLogs.push(`[youtubei.js] ${clientType} failed: ${e.message}`);
      }
    }
  } catch (e) {
    debugLogs.push(`[youtubei.js] ${e.message}`);
  }

  return null;
}

async function fetchViaPlayerResponseInHtml(videoId, pageUrl, profile, debugLogs, label) {
  debugLogs.push(`[${label}] Fetching ${pageUrl}`);

  const response = await youtubeFetch(pageUrl, profile);
  if (!response.ok) {
    debugLogs.push(`[${label}] HTTP ${response.status}`);
    return null;
  }

  const html = await response.text();
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/s)
    || html.match(/var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s);

  if (!match) {
    debugLogs.push(`[${label}] ytInitialPlayerResponse not found`);
    return null;
  }

  const playerData = JSON.parse(match[1]);
  const captionTracks = findCaptionTracksInResponse(playerData);
  debugLogs.push(`[${label}] caption tracks=${captionTracks?.length || 0}`);

  if (!captionTracks?.length) return null;

  for (const track of captionTracks) {
    if (!track.baseUrl) continue;

    const body = await fetchCaptionTrackBody(track.baseUrl, profile);
    const parsed = parseUniversalCaptions(body, track.languageCode);
    if (parsed?.length) {
      debugLogs.push(`[${label}] SUCCESS ${parsed.length} captions`);
      return { rawItems: parsed };
    }
  }

  return null;
}

/**
 * Scrape caption tracks from watch/embed pages using direct server-side fetch.
 */
async function fetchViaWatchPage(videoId, debugLogs = []) {
  const pageUrls = [
    `https://www.youtube.com/watch?v=${videoId}`,
    `https://www.youtube.com/embed/${videoId}`
  ];

  for (const pageUrl of pageUrls) {
    for (const profile of YOUTUBE_FETCH_PROFILES) {
      try {
        const result = await fetchViaPlayerResponseInHtml(
          videoId,
          pageUrl,
          profile,
          debugLogs,
          `WatchPage:${profile.name}`
        );
        if (result?.rawItems?.length) return result;
      } catch (e) {
        debugLogs.push(`[WatchPage:${profile.name}] ${e.message}`);
      }
    }
  }

  return null;
}

/**
 * Direct timedtext API — server-side only, no browser CORS involved.
 */
async function fetchViaDirectTimedText(videoId, debugLogs = []) {
  debugLogs.push('[TimedText] Trying direct timedtext endpoints...');

  const langAttempts = ['hi', 'en', 'or', 'a.hi', 'a.en', 'en-US', 'hi-IN'];
  const formats = ['srv3', 'json3', 'srv1'];

  for (const lang of langAttempts) {
    for (const fmt of formats) {
      for (const profile of YOUTUBE_FETCH_PROFILES) {
        try {
          const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=${fmt}&caps=asr`;
          const response = await youtubeFetch(url, profile);
          if (!response.ok) continue;

          const body = await response.text();
          const parsed = parseUniversalCaptions(body, lang);
          if (parsed?.length) {
            debugLogs.push(`[TimedText] SUCCESS ${parsed.length} captions (${lang}, ${fmt})`);
            return { rawItems: parsed };
          }
        } catch (e) {
          debugLogs.push(`[TimedText] ${lang}/${fmt} failed: ${e.message}`);
        }
      }
    }
  }

  return null;
}

async function fetchViaYoutubeTranscript(videoId, fetchImpl, debugLogs, label) {
  const langAttempts = [undefined, 'hi', 'en'];

  for (const lang of langAttempts) {
    try {
      const opts = lang ? { lang, fetch: fetchImpl } : { fetch: fetchImpl };
      debugLogs.push(`[${label}] fetchTranscript lang=${lang || 'auto'}`);
      const rawItems = await YoutubeTranscript.fetchTranscript(videoId, opts);
      if (rawItems?.length) {
        debugLogs.push(`[${label}] SUCCESS ${rawItems.length} captions`);
        return rawItems;
      }
    } catch (e) {
      debugLogs.push(`[${label}] lang=${lang || 'auto'} failed: ${e.message}`);
    }
  }

  return [];
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

  // Try official, lightweight oEmbed API first (highly reliable on Vercel & cloud platforms)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
    const oembedRes = await fetch(oembedUrl);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData.title) title = oembedData.title;
      if (oembedData.author_name) author = oembedData.author_name;
    }
  } catch (err) {
    console.warn('[oEmbed Metadata Fetch Warning]', err.message);
  }

  // Fallback to page scraping if oEmbed failed or was partial
  if (title === 'YouTube Video' || author === 'YouTube Channel') {
    try {
      const response = await youtubeFetch(pageUrl, YOUTUBE_FETCH_PROFILES[1]);
      if (response.ok) {
        const html = await response.text();
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)">/);
        if (titleMatch && title === 'YouTube Video') title = he.decode(titleMatch[1]);

        const authorMatch = html.match(/<link itemprop="name" content="([^"]+)">/);
        if (authorMatch && author === 'YouTube Channel') author = he.decode(authorMatch[1]);
      }
    } catch (e) {
      console.error('Metadata page fetch warning:', e.message);
    }
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

function applyInnerTubeMetadata(metadata, innerTubeRes) {
  if (!innerTubeRes) return;
  if (innerTubeRes.title) metadata.title = innerTubeRes.title;
  if (innerTubeRes.author) metadata.author = innerTubeRes.author;
  if (innerTubeRes.lengthSeconds) {
    metadata.lengthSeconds = innerTubeRes.lengthSeconds;
    metadata.durationFormatted = formatTime(innerTubeRes.lengthSeconds);
  }
}

async function fetchViaYoutubeTranscriptAI(videoId, debugLogs = []) {
  debugLogs.push('[youtube-transcript.ai] Trying public youtube-transcript.ai service...');
  const url = `https://youtube-transcript.ai/transcript/${videoId}.txt`;
  
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': WEB_UA } }, 8000);
    if (!res.ok) {
      debugLogs.push(`[youtube-transcript.ai] HTTP ${res.status}`);
      return null;
    }
    
    const text = await res.text();
    if (!text || !text.trim() || text.includes('Error')) {
      debugLogs.push('[youtube-transcript.ai] Invalid or error response');
      return null;
    }
    
    const lines = text.split('\n');
    const rawItems = [];
    
    for (const line of lines) {
      const match = line.match(/^\[(?:(\d+):)?(\d+):(\d+)\]\s+(.*)$/);
      if (match) {
        const hrs = parseInt(match[1] || '0', 10);
        const mins = parseInt(match[2], 10);
        const secs = parseInt(match[3], 10);
        const offsetMs = (hrs * 3600 + mins * 60 + secs) * 1000;
        const textContent = match[4].trim();
        
        rawItems.push({
          text: textContent,
          offset: offsetMs,
          duration: 3000
        });
      }
    }
    
    for (let i = 0; i < rawItems.length; i++) {
      if (i < rawItems.length - 1) {
        const nextOffset = rawItems[i + 1].offset;
        const diff = nextOffset - rawItems[i].offset;
        rawItems[i].duration = Math.max(diff, 500);
      }
    }
    
    if (rawItems.length > 0) {
      debugLogs.push(`[youtube-transcript.ai] SUCCESS! Extracted ${rawItems.length} lines.`);
      return { rawItems };
    }
  } catch (err) {
    debugLogs.push(`[youtube-transcript.ai] Failed: ${err.message}`);
  }
  return null;
}

async function getYouTubeData(url, onProgressUpdate, debugLogs = []) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please paste a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=...)');
  }

  debugLogs.push(`[getYouTubeData] videoId=${videoId}`);
  if (onProgressUpdate) onProgressUpdate('video_detected');

  const metadata = await getYouTubeMetadata(videoId);
  if (onProgressUpdate) onProgressUpdate('audio_extracted');

  let rawItems = [];

  const customYoutubeFetch = (fetchUrl, options = {}) =>
    youtubeFetch(fetchUrl, YOUTUBE_FETCH_PROFILES[1], options);

  // Layer 0: Public youtube-transcript.ai API (extremely fast and cloud-friendly)
  if (!rawItems.length) {
    debugLogs.push('[Layer 0] youtube-transcript.ai API...');
    const transcriptAiRes = await fetchViaYoutubeTranscriptAI(videoId, debugLogs);
    if (transcriptAiRes?.rawItems?.length) {
      rawItems = transcriptAiRes.rawItems;
    }
  }

  // Layer 1: InnerTube direct API (best for Vercel/serverless)
  if (!rawItems.length) {
    debugLogs.push('[Layer 1] InnerTube direct API...');
    const innerTubeRes = await fetchViaInnerTube(videoId, debugLogs);
    if (innerTubeRes?.rawItems?.length) {
      rawItems = innerTubeRes.rawItems;
      applyInnerTubeMetadata(metadata, innerTubeRes);
    }
  }

  // Layer 2: Invidious fallback for cloud/datacenter IPs blocked by YouTube
  if (!rawItems.length) {
    debugLogs.push('[Layer 2] Invidious fallback...');
    const invidiousRes = await fetchViaInvidious(videoId, debugLogs);
    if (invidiousRes?.rawItems?.length) {
      rawItems = invidiousRes.rawItems;
    }
  }

  // Layer 3: youtubei.js library (direct InnerTube client)
  if (!rawItems.length) {
    debugLogs.push('[Layer 3] youtubei.js...');
    const youtubeiRes = await fetchViaYoutubeiJS(videoId, debugLogs);
    if (youtubeiRes?.rawItems?.length) {
      rawItems = youtubeiRes.rawItems;
      applyInnerTubeMetadata(metadata, youtubeiRes);
    }
  }

  // Layer 4: Watch/embed page scrape (direct server fetch)
  if (!rawItems.length) {
    debugLogs.push('[Layer 4] Watch page scrape...');
    const watchRes = await fetchViaWatchPage(videoId, debugLogs);
    if (watchRes?.rawItems?.length) {
      rawItems = watchRes.rawItems;
    }
  }

  // Layer 5: Direct timedtext endpoints
  if (!rawItems.length) {
    debugLogs.push('[Layer 5] Direct timedtext...');
    const timedTextRes = await fetchViaDirectTimedText(videoId, debugLogs);
    if (timedTextRes?.rawItems?.length) {
      rawItems = timedTextRes.rawItems;
    }
  }

  // Layer 6: youtube-transcript with direct server fetch
  if (!rawItems.length) {
    debugLogs.push('[Layer 6] youtube-transcript direct fetch...');
    rawItems = await fetchViaYoutubeTranscript(
      videoId,
      (fetchUrl, options) => youtubeFetch(fetchUrl, YOUTUBE_FETCH_PROFILES[0], options),
      debugLogs,
      'Layer 6'
    );
  }

  // Layer 7: youtube-transcript with consent cookies
  if (!rawItems.length) {
    debugLogs.push('[Layer 7] youtube-transcript with consent headers...');
    rawItems = await fetchViaYoutubeTranscript(
      videoId,
      customYoutubeFetch,
      debugLogs,
      'Layer 7'
    );
  }

  if (!rawItems.length) {
    debugLogs.push(`[getYouTubeData] ALL DIRECT METHODS FAILED for videoId=${videoId}`);
    throw new Error(`Could not extract captions for video ID (${videoId}). Please check if the video has captions/subtitles enabled on YouTube.`);
  }

  if (!metadata.title || metadata.title === 'YouTube Video') {
    const innerTubeRes = await fetchViaInnerTube(videoId, []);
    applyInnerTubeMetadata(metadata, innerTubeRes);
  }

  if (onProgressUpdate) onProgressUpdate('speech_detected');

  const processed = processRawItemsToYouTubeData(rawItems, metadata);
  if (onProgressUpdate) onProgressUpdate('transcript_generated');
  return processed;
}

function processRawItemsToYouTubeData(rawItems, metadata, sourceLanguageOverride) {
  const fullTextSample = rawItems.slice(0, 15).map(i => i.text).join(' ');
  const sourceLanguage = sourceLanguageOverride || detectSpokenLanguage(fullTextSample);

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

  const linesWithSpeakers = assignSpeakers(mergedLines);
  const linesWithId = linesWithSpeakers.map((l, index) => ({
    id: index + 1,
    ...l
  }));

  if (linesWithId.length > 0) {
    metadata.lengthSeconds = Math.ceil(linesWithId[linesWithId.length - 1].end);
    metadata.durationFormatted = formatTime(metadata.lengthSeconds);
  }

  return {
    metadata,
    sourceLanguage,
    lines: linesWithId
  };
}

async function buildYouTubeDataFromRawItems(rawItems, metadata, sourceLanguageOverride, onProgressUpdate) {
  if (onProgressUpdate) onProgressUpdate('speech_detected');
  const result = processRawItemsToYouTubeData(rawItems, metadata, sourceLanguageOverride);
  if (onProgressUpdate) onProgressUpdate('transcript_generated');
  return result;
}

module.exports = {
  extractVideoId,
  formatTime,
  getYouTubeData,
  buildYouTubeDataFromRawItems,
  parseUniversalCaptions,
  getYouTubeMetadata
};
