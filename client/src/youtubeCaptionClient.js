const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export function extractVideoId(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

function decodeHtml(text) {
  const el = document.createElement('textarea');
  el.innerHTML = text;
  return el.value;
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const padMins = String(mins).padStart(2, '0');
  const padSecs = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${padMins}:${padSecs}`;
  }
  return `${padMins}:${padSecs}`;
}

function parseVttTimestamp(value) {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseCaptionBody(body, lang = 'en') {
  if (!body?.trim()) return [];

  if (body.trim().startsWith('{')) {
    try {
      const data = JSON.parse(body);
      if (data?.events) {
        return data.events.flatMap((evt) => {
          if (!evt.segs?.length) return [];
          const text = evt.segs.map((s) => s.utf8).join('').trim();
          if (!text || text === '\n') return [];
          return [{
            text: decodeHtml(text),
            offset: evt.tStartMs || 0,
            duration: evt.dDurationMs || 3000,
            lang
          }];
        });
      }
    } catch (e) {}
  }

  if (body.includes('-->')) {
    const results = [];
    for (const block of body.replace(/\r/g, '').split(/\n\n+/)) {
      const lines = block.split('\n').filter(Boolean);
      const idx = lines.findIndex((line) => line.includes('-->'));
      if (idx === -1) continue;

      const [startRaw, endRaw] = lines[idx].split('-->').map((part) => part.trim().split(' ')[0]);
      const text = lines.slice(idx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
      if (!text) continue;

      const startSec = parseVttTimestamp(startRaw);
      const endSec = parseVttTimestamp(endRaw);
      results.push({
        text: decodeHtml(text),
        offset: startSec * 1000,
        duration: Math.max((endSec - startSec) * 1000, 500),
        lang
      });
    }
    if (results.length) return results;
  }

  const textMatches = body.matchAll(/<text\s+[^>]*start=["']?([\d.]+)["']?[^>]*>(.*?)<\/text>/gi);
  const xmlResults = [];
  for (const match of textMatches) {
    const startSec = parseFloat(match[1]);
    const startMs = startSec > 1000 ? startSec : startSec * 1000;
    const inner = match[2].replace(/<[^>]+>/g, '').trim();
    if (!inner) continue;
    xmlResults.push({
      text: decodeHtml(inner),
      offset: startMs,
      duration: 3000,
      lang
    });
  }

  return xmlResults;
}

function pickCaptionTrack(items) {
  const priority = ['hi', 'en', 'or'];
  for (const code of priority) {
    const match = items.find((item) => item.snippet?.language?.toLowerCase().startsWith(code));
    if (match) return match;
  }
  return items[0];
}

export function isGoogleAuthConfigured() {
  return Boolean(GOOGLE_CLIENT_ID);
}

export function requestGoogleAccessToken(options = {}) {
  const { forceAccountPicker = false } = options;

  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID is not configured.'));
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Sign-In is still loading. Please try again in a moment.'));
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        resolve(response.access_token);
      }
    });

    client.requestAccessToken({ prompt: forceAccountPicker ? 'select_account' : '' });
  });
}

export async function fetchGoogleUserProfile(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    return { name: 'Google user', email: 'Connected' };
  }

  return res.json();
}

export function revokeGoogleAccessToken(accessToken) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    window.google.accounts.oauth2.revoke(accessToken, (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      resolve();
    });
  });
}

export async function fetchVideoMetadataWithGoogle(videoId, accessToken) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error('Could not fetch video details from your YouTube account.');
  }

  const data = await res.json();
  const video = data.items?.[0];
  if (!video) {
    throw new Error('Video not found on YouTube.');
  }

  const duration = video.contentDetails?.duration || '';
  const seconds = parseIsoDuration(duration);

  return {
    videoId,
    title: video.snippet?.title || 'YouTube Video',
    author: video.snippet?.channelTitle || 'YouTube Channel',
    lengthSeconds: seconds,
    durationFormatted: formatTime(seconds),
    thumbnail: video.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

function parseIsoDuration(value) {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match.map((part) => Number(part || 0));
  return h * 3600 + m * 60 + s;
}

export async function fetchCaptionsWithGoogleToken(videoId, accessToken) {
  const listRes = await fetch(
    `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Could not list captions with your Google account.');
  }

  const listData = await listRes.json();
  const tracks = listData.items || [];
  if (!tracks.length) {
    throw new Error('No captions/subtitles found for this video on YouTube.');
  }

  const track = pickCaptionTrack(tracks);
  const lang = track.snippet?.language || 'en';

  for (const fmt of ['srv3', 'vtt', 'ttml']) {
    const downloadRes = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${track.id}?tfmt=${fmt}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!downloadRes.ok) continue;

    const body = await downloadRes.text();
    const rawItems = parseCaptionBody(body, lang);
    if (rawItems.length) {
      return { rawItems, lang, trackName: track.snippet?.name || lang };
    }
  }

  throw new Error('Could not download captions with your Google account for this video.');
}

export async function extractCaptionsInBrowser(videoId, accessToken) {
  const [metadata, captionData] = await Promise.all([
    fetchVideoMetadataWithGoogle(videoId, accessToken),
    fetchCaptionsWithGoogleToken(videoId, accessToken)
  ]);

  return {
    metadata,
    rawItems: captionData.rawItems,
    sourceLanguage: captionData.lang
  };
}
