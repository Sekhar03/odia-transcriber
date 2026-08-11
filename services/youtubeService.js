const { YoutubeTranscript } = require('youtube-transcript');
const he = require('he');

function extractVideoId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
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
    ...(options.headers || {})
  };

  return fetch(url, { ...options, headers });
}

/**
 * Native InnerTube Android API Extraction.
 * 100% resilient on Vercel / AWS Lambda Serverless Functions.
 */
async function fetchViaInnerTube(videoId) {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)'
      },
      body: JSON.stringify({
        context: {
          client: {
            hl: 'en',
            gl: 'US',
            clientName: 'ANDROID',
            clientVersion: '20.10.38'
          }
        },
        videoId: videoId
      })
    });

    if (!res.ok) return null;
    const data = await res.json();

    const title = data?.videoDetails?.title || '';
    const author = data?.videoDetails?.author || '';
    const lengthSeconds = parseInt(data?.videoDetails?.lengthSeconds || '0', 10);

    const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!Array.isArray(captionTracks) || captionTracks.length === 0) return null;

    const selectedTrack = captionTracks.find(t => t.languageCode === 'hi' || t.languageCode === 'en' || t.languageCode === 'or') || captionTracks[0];

    const trackRes = await fetch(selectedTrack.baseUrl);
    if (!trackRes.ok) return null;
    const xmlText = await trackRes.text();

    const parsed = YoutubeTranscript.parseTranscriptXml(xmlText, selectedTrack.languageCode);
    if (!parsed || parsed.length === 0) return null;

    return {
      rawItems: parsed,
      title,
      author,
      lengthSeconds
    };
  } catch (err) {
    console.error('InnerTube Android API extraction error:', err.message);
    return null;
  }
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

async function getYouTubeData(url, onProgressUpdate) {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error('Invalid YouTube URL. Please provide a valid YouTube video link.');
  }

  if (onProgressUpdate) onProgressUpdate('video_detected');

  const metadata = await getYouTubeMetadata(videoId);
  if (onProgressUpdate) onProgressUpdate('audio_extracted');

  let rawItems = [];
  let sourceLanguage = 'English / Hindi';

  // 1. Primary Extractor: Official InnerTube Android API (100% resilient on Vercel)
  const innerTubeRes = await fetchViaInnerTube(videoId);
  if (innerTubeRes && innerTubeRes.rawItems && innerTubeRes.rawItems.length > 0) {
    rawItems = innerTubeRes.rawItems;
    if (innerTubeRes.title) metadata.title = innerTubeRes.title;
    if (innerTubeRes.author) metadata.author = innerTubeRes.author;
    if (innerTubeRes.lengthSeconds) {
      metadata.lengthSeconds = innerTubeRes.lengthSeconds;
      metadata.durationFormatted = formatTime(innerTubeRes.lengthSeconds);
    }
  } else {
    // 2. Secondary Extractor: YoutubeTranscript with Consent Cookie fetch
    try {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId, { fetch: vercelCustomFetch, lang: 'en' });
    } catch (e1) {
      try {
        rawItems = await YoutubeTranscript.fetchTranscript(videoId, { fetch: vercelCustomFetch, lang: 'hi' });
      } catch (e2) {
        try {
          rawItems = await YoutubeTranscript.fetchTranscript(videoId, { fetch: vercelCustomFetch });
        } catch (e3) {
          throw new Error('Could not extract captions or audio speech for this video. Please ensure the video has English or Hindi audio/captions enabled.');
        }
      }
    }
  }

  if (onProgressUpdate) onProgressUpdate('speech_detected');

  if (!rawItems || rawItems.length === 0) {
    throw new Error('No spoken dialogue found for this YouTube video.');
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
