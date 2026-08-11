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

// Detect mixed languages (Hinglish / Hindi + English)
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

// Speaker Diarization logic based on pauses, turn-taking, and conversational cues
function assignSpeakers(rawLines) {
  let currentSpeaker = 1;
  let linesWithSpeakers = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const prevLine = i > 0 ? rawLines[i - 1] : null;

    // Detect speaker turn triggers:
    // 1. Long pause (> 2.8 seconds gap between dialogues)
    // 2. Question mark in previous line followed by statement
    // 3. Conversational intro markers ("Yes", "Exactly", "So", "Haan", "Ji", "Right")
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
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
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

  // Fetch transcript (prioritize English, Hindi, Hinglish, auto)
  try {
    rawItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
  } catch (e1) {
    try {
      rawItems = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'hi' });
    } catch (e2) {
      try {
        rawItems = await YoutubeTranscript.fetchTranscript(videoId);
      } catch (e3) {
        throw new Error('Could not extract captions or audio speech for this video. Please ensure the video has English or Hindi audio/captions enabled.');
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
  }).filter(l => l.text && l.text !== '[Music]' && l.text !== '[♪♪♪]');

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
