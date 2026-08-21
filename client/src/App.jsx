import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Search,
  Languages,
  Play,
  Clock,
  Sparkles,
  Edit3,
  RefreshCw,
  FileDown,
  Layers,
  Info,
  ExternalLink,
  Users,
  CheckCircle2,
  AlertCircle,
  Globe,
  Mic,
  MicOff
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './index.css';
import {
  extractVideoId
} from './youtubeCaptionClient';

const YoutubeIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// Use same-origin API (Vercel serverless / local Express). Override via VITE_API_BASE_URL if needed.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const SAMPLE_VIDEOS = [
  {
    name: 'Hindi Educational / Talk',
    lang: 'Hindi + English',
    url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8'
  },
  {
    name: 'English Tech Interview',
    lang: 'English',
    url: 'https://www.youtube.com/watch?v=8jPQjjsBbIc'
  },
  {
    name: 'English Music / Dialogue',
    lang: 'English',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  }
];

const PIPELINE_STEPS = [
  { id: 'video_detected', label: 'Video detected' },
  { id: 'audio_extracted', label: 'Audio extracted' },
  { id: 'speech_detected', label: 'Speech detected' },
  { id: 'transcript_generated', label: 'Transcript generated' },
  { id: 'converting_to_target', label: 'Converted dialogue' },
  { id: 'pdf_generated', label: 'PDF ready' }
];

const LANG_NAMES = {
  or: 'Odia',
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  ta: 'Tamil',
  mr: 'Marathi',
  es: 'Spanish',
  fr: 'French',
  gu: 'Gujarati',
  kn: 'Kannada',
  pa: 'Punjabi'
};

export default function App() {
  const [url, setUrl] = useState('');
  const [targetLang, setTargetLang] = useState('or'); // 'or' | 'en'
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [error, setError] = useState(null);

  const [metadata, setMetadata] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('');
  const [lines, setLines] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('All');
  const [viewMode, setViewMode] = useState('dual'); // dual | odia_only | monologue
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [editingLineId, setEditingLineId] = useState(null);

  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfLayout, setPdfLayout] = useState('dual'); // dual | odia_only | monologue
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState(null);
  const iframeRef = useRef(null);

  // Microphone recording states
  const [activeTab, setActiveTab] = useState('youtube'); // 'youtube' | 'mic'
  const [isRecording, setIsRecording] = useState(false);
  const [recordedText, setRecordedText] = useState('');
  const [recordingLang, setRecordingLang] = useState('en-US');
  const [micProcessing, setMicProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const startVisualizer = (stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current) {
          animationFrameRef.current = requestAnimationFrame(draw);
          return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        animationFrameRef.current = requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#0f172a'; // Slate-900 background matching theme
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] * 0.6;

          const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
          gradient.addColorStop(0, '#0d9488'); // teal-600
          gradient.addColorStop(1, '#10b981'); // emerald-500

          ctx.fillStyle = gradient;
          const y = (canvas.height - barHeight) / 2;
          ctx.fillRect(x, y, barWidth - 2, barHeight);

          x += barWidth;
        }
      };

      draw();
    } catch (e) {
      console.error('Failed to start audio visualizer:', e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm' };
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        handleTranscribeAudio(audioBlob, mediaRecorder.mimeType);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      setRecordedText('Listening... speak now and click Stop when done.');

      // Start real-time speaking graph visualizer
      startVisualizer(stream);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Could not access microphone. Please check your browser/system microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
  };

  const formatTime = (seconds) => {
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
  };

  const handleTranscribeAudio = async (blob, mimeType) => {
    setMicProcessing(true);
    setError(null);
    setRecordedText('Processing audio with Gemini...');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const res = await fetch(`${API_BASE_URL}/api/transcribe-mic`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioData: base64Data,
              mimeType: mimeType || 'audio/webm',
              sourceLang: recordingLang,
              targetLang
            })
          });

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Failed to transcribe audio.');
          }

          const newLine = {
            id: lines.length + 1,
            start: lines.length > 0 ? lines[lines.length - 1].end + 1 : 0,
            end: lines.length > 0 ? lines[lines.length - 1].end + 5 : 4,
            startFormatted: formatTime(lines.length > 0 ? lines[lines.length - 1].end + 1 : 0),
            endFormatted: formatTime(lines.length > 0 ? lines[lines.length - 1].end + 5 : 4),
            speaker: 'Mic Speaker',
            text: data.cleanedText,
            odiaText: data.translatedText,
            translatedText: data.translatedText
          };

          if (!metadata) {
            setMetadata({
              title: 'Microphone & Live Speech Transcription',
              author: 'Live Recording',
              durationFormatted: 'N/A',
              videoId: ''
            });
            setSourceLanguage(recordingLang.split('-')[0].toUpperCase());
          }

          setLines(prev => [...prev, newLine]);
          setRecordedText(data.cleanedText);

          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
          });
        } catch (err) {
          setError(err.message || 'Error transcribing mic speech.');
          setRecordedText('');
        } finally {
          setMicProcessing(false);
        }
      };
    } catch (err) {
      setError(err.message || 'Error reading audio file.');
      setRecordedText('');
      setMicProcessing(false);
    }
  };

  const handleProcessMicSpeech = async () => {
    if (!recordedText.trim() || recordedText.startsWith('Listening...') || recordedText.startsWith('Processing audio')) {
      setError('Please type or record some speech first.');
      return;
    }

    setMicProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/transcribe-mic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: recordedText,
          sourceLang: recordingLang,
          targetLang
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to process speech text.');
      }

      const newLine = {
        id: lines.length + 1,
        start: lines.length > 0 ? lines[lines.length - 1].end + 1 : 0,
        end: lines.length > 0 ? lines[lines.length - 1].end + 5 : 4,
        startFormatted: formatTime(lines.length > 0 ? lines[lines.length - 1].end + 1 : 0),
        endFormatted: formatTime(lines.length > 0 ? lines[lines.length - 1].end + 5 : 4),
        speaker: 'Mic Speaker',
        text: data.cleanedText,
        odiaText: data.translatedText,
        translatedText: data.translatedText
      };

      if (!metadata) {
        setMetadata({
          title: 'Microphone & Live Speech Transcription',
          author: 'Live Recording',
          durationFormatted: 'N/A',
          videoId: ''
        });
        setSourceLanguage(recordingLang.split('-')[0].toUpperCase());
      }

      setLines(prev => [...prev, newLine]);
      setRecordedText('');

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (err) {
      setError(err.message || 'Error processing speech.');
    } finally {
      setMicProcessing(false);
    }
  };

  const isCloudDeploy = typeof window !== 'undefined'
    && window.location.hostname.includes('vercel.app');




  const transcribeFromServer = async (finalUrl, selectedLang, progressTimer) => {
    const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: finalUrl, targetLang: selectedLang })
    });

    const data = await res.json();
    clearInterval(progressTimer);

    if (!data.success) {
      throw new Error(data.error || 'Failed to transcribe YouTube video.');
    }

    return data;
  };

  const simulateProgress = () => {
    setCompletedSteps([]);
    const steps = PIPELINE_STEPS.map(s => s.id);
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length - 1) {
        setCompletedSteps(prev => [...prev, steps[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 600);
    return interval;
  };

  const handleTranscribe = async (targetUrl = url, selectedLang = targetLang) => {
    const finalUrl = targetUrl.trim();
    if (!finalUrl) {
      setError('Please paste a valid YouTube video link.');
      return;
    }

    // Google Sign-In is treated as a fallback, so we do not block transcription up front.

    setLoading(true);
    setError(null);
    let progressTimer = simulateProgress();

    try {
      let data;
      try {
        data = await transcribeFromServer(finalUrl, selectedLang, progressTimer);
      } catch (serverErr) {
        clearInterval(progressTimer);
        setError(serverErr.message || 'Server transcription failed.');
        return;
      }

      setMetadata(data.metadata);
      setSourceLanguage(data.sourceLanguage);
      setLines(data.lines);
      setSummary(data.summary);
      setPdfTitle(data.metadata.title);
      setCompletedSteps(PIPELINE_STEPS.map(s => s.id));

      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch (err) {
      clearInterval(progressTimer);
      if (isCloudDeploy && !googleConfigured) {
        setError('Cloud mode requires Google Sign-In. Add VITE_GOOGLE_CLIENT_ID in Vercel environment variables and redeploy.');
      } else {
        setError(err.message || 'An error occurred during transcription.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (sampleUrl) => {
    setUrl(sampleUrl);
    handleTranscribe(sampleUrl, targetLang);
  };

  const handleLineEdit = (id, newText) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, odiaText: newText } : line))
    );
  };

  const handleCopyText = () => {
    const fullText = lines.map((l) => `[${l.startFormatted}] ${l.speaker}: ${l.odiaText}`).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPDF = async () => {
    if (!lines || lines.length === 0) return;
    setPdfGenerating(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          lines,
          pdfLayout,
          pdfTitle: pdfTitle || metadata.title,
          sourceLanguage,
          targetLang,
          summary
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `PDF server error (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const cleanTitle = (pdfTitle || metadata?.title || `YouTube_Dialogue_${targetLang.toUpperCase()}`)
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40) || `YouTube_Dialogue_${targetLang.toUpperCase()}`;
      link.download = `${cleanTitle}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setIsPdfModalOpen(false);
      confetti({
        particleCount: 100,
        spread: 85,
        origin: { y: 0.7 }
      });
    } catch (err) {
      alert('Error generating PDF: ' + err.message);
    } finally {
      setPdfGenerating(false);
    }
  };

  const exportSRT = () => {
    const srtContent = lines
      .map((l, index) => {
        const startSRT = formatSrtTime(l.start);
        const endSRT = formatSrtTime(l.end);
        return `${index + 1}\n${startSRT} --> ${endSRT}\n${l.speaker}: ${l.odiaText}\n`;
      })
      .join('\n');

    downloadFile(srtContent, `${metadata.title}_${targetLang.toUpperCase()}.srt`, 'text/plain');
  };

  const exportTXT = () => {
    const txtContent = lines.map((l) => `[${l.startFormatted}] ${l.speaker}:\n${l.odiaText}`).join('\n\n');
    downloadFile(txtContent, `${metadata.title}_${targetLang.toUpperCase()}.txt`, 'text/plain');
  };

  const formatSrtTime = (sec) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    const millis = Math.floor((sec % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const seekTo = (seconds) => {
    setSelectedLineId(seconds);
    if (iframeRef.current) {
      iframeRef.current.src = `https://www.youtube.com/embed/${metadata.videoId}?autoplay=1&start=${Math.floor(seconds)}`;
    }
  };

  const speakersList = ['All', ...new Set(lines.map(l => l.speaker))];

  const filteredLines = lines.filter((l) => {
    const matchesSearch =
      l.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.odiaText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpeaker = selectedSpeaker === 'All' || l.speaker === selectedSpeaker;
    return matchesSearch && matchesSpeaker;
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Header Banner */}
      <header className="glass-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border-l-4 border-l-teal-500">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <YoutubeIcon className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                YouTube AI Transcriber
              </h1>
              <span className="badge badge-teal">Odia & English PDF</span>
            </div>
            <p className="text-slate-400 text-sm md:text-base mt-1 odia-text">
              Transcribe complete YouTube dialogue (English, Hindi & Hinglish) into Odia (ଓଡ଼ିଆ) or English PDF with speaker turns.
            </p>
          </div>
        </div>

        {/* Target Language */}
        <div className="flex flex-col items-stretch gap-3">
          <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700/50">
            <Globe className="w-5 h-5 text-teal-400" />
            <div className="text-xs">
              <span className="text-slate-400 block mb-1.5">Target Language:</span>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-slate-950 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="or">ଓଡ଼ିଆ (Odia)</option>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Input Section */}
      <section className="glass-panel p-6 flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 pb-2 mb-2 gap-4">
          <button
            onClick={() => { setActiveTab('youtube'); setError(null); }}
            className={`pb-2 px-1 text-sm font-semibold transition ${
              activeTab === 'youtube' ? 'border-b-2 border-teal-500 text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            YouTube Transcribe
          </button>
          <button
            onClick={() => { setActiveTab('mic'); setError(null); }}
            className={`pb-2 px-1 text-sm font-semibold transition ${
              activeTab === 'mic' ? 'border-b-2 border-teal-500 text-teal-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Microphone Live Speech
          </button>
        </div>

        {activeTab === 'youtube' ? (
          <>
            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Paste YouTube Video URL:
            </label>

            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-900/80 border border-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl py-3.5 px-4 text-slate-100 placeholder-slate-500 outline-none transition"
                  onKeyDown={(e) => e.key === 'Enter' && handleTranscribe()}
                />
                {url && (
                  <button
                    onClick={() => setUrl('')}
                    className="absolute right-3 top-3.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                onClick={() => handleTranscribe()}
                disabled={loading}
                className="glow-btn px-6 py-3.5 flex items-center justify-center gap-2 text-base"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Transcribe ({LANG_NAMES[targetLang] || 'Odia'})</span>
                  </>
                )}
              </button>
            </div>

            {/* Sample Quick Links */}
            <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Try Sample Videos:</span>
              {SAMPLE_VIDEOS.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSampleClick(sample.url)}
                  disabled={loading}
                  className="bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-teal-500/40 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                >
                  <YoutubeIcon className="w-3.5 h-3.5 text-red-400" />
                  <span>{sample.name}</span>
                  <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-teal-400 font-mono">
                    {sample.lang}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Mic className="w-4 h-4 text-teal-400" />
                  Speak into your microphone:
                </label>
                <p className="text-xs text-slate-400">
                  Select your spoken language. The AI will correct muffled/unclear accents, grammatical speech slips, and translate.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Spoken Language:</span>
                <select
                  value={recordingLang}
                  onChange={(e) => setRecordingLang(e.target.value)}
                  className="bg-slate-950 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="hi-IN">Hindi (हिन्दी)</option>
                  <option value="or-IN">Odia (ଓଡ଼ିଆ)</option>
                  <option value="bn-IN">Bengali (বাংলা)</option>
                  <option value="te-IN">Telugu (తెలుగు)</option>
                  <option value="ta-IN">Tamil (தமிழ்)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={micProcessing}
                className={`px-6 py-4 flex items-center justify-center gap-3 text-base rounded-xl font-bold transition flex-1 shadow-lg ${
                  isRecording
                    ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                    : 'bg-teal-600 hover:bg-teal-500 text-white'
                }`}
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    <span>Stop Recording</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>Start Recording</span>
                  </>
                )}
              </button>

              <button
                onClick={handleProcessMicSpeech}
                disabled={isRecording || micProcessing || !recordedText.trim()}
                className="glow-btn px-6 py-4 flex items-center justify-center gap-2 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {micProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>AI Analyzing & Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Analyze & Translate to {LANG_NAMES[targetLang] || 'Odia'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Audio Visualizer Speaking Graph */}
            {isRecording && (
              <div className="flex flex-col items-center justify-center bg-slate-950/80 p-4 rounded-xl border border-teal-500/20">
                <span className="text-[10px] uppercase font-bold text-teal-400 mb-2 animate-pulse flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  Speaking Graph (Audio Waveform)
                </span>
                <canvas
                  ref={canvasRef}
                  width="500"
                  height="70"
                  className="w-full h-16 bg-slate-900 rounded-lg"
                />
              </div>
            )}

            {/* Live Transcript Preview */}
            <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Live Transcription Preview (Edit or Speak):
              </span>
              <textarea
                value={recordedText}
                onChange={(e) => {
                  setRecordedText(e.target.value);
                  if (error && error.startsWith('Notice:')) {
                    setError(null);
                  }
                }}
                placeholder={isRecording ? 'Listening for speech...' : 'Click "Start Recording" and speak, or type/paste your text here directly.'}
                className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 text-sm text-slate-300 min-h-[100px] outline-none focus:border-teal-500/50 resize-y font-mono italic"
              />
            </div>
          </div>
        )}


        {/* Processing Pipeline Checklist */}
        {loading && (
          <div className="mt-3 bg-slate-900/90 border border-teal-500/30 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-teal-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                Processing Pipeline ({LANG_NAMES[targetLang] || 'Odia'} Target):
              </h4>
              <span className="text-xs font-mono text-teal-400 bg-teal-950/80 px-2.5 py-1 rounded border border-teal-800">
                Parallel AI Engine Active
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PIPELINE_STEPS.map((step) => {
                const isDone = completedSteps.includes(step.id);
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-2 text-xs p-2 rounded-lg border transition ${
                      isDone
                        ? 'bg-teal-950/60 border-teal-500/40 text-teal-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-4 h-4 ${isDone ? 'text-teal-400' : 'text-slate-700'}`}
                    />
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error/Notice Alert */}
        {error && (
          <div className={`mt-2 border rounded-xl p-4 flex items-start gap-3 ${
            error.startsWith('Notice:')
              ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
              : 'bg-red-950/50 border-red-800 text-red-300'
          }`}>
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              error.startsWith('Notice:') ? 'text-amber-400' : 'text-red-400'
            }`} />
            <div className="text-sm">{error}</div>
          </div>
        )}
      </section>

      {/* Main Content Workspace */}
      {metadata && lines.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Video Player & Info */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Embedded YouTube Player */}
            <div className="glass-panel overflow-hidden p-2">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
                <iframe
                  ref={iframeRef}
                  src={`https://www.youtube.com/embed/${metadata.videoId}`}
                  title={metadata.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>

            {/* Video Metadata Card */}
            <div className="glass-panel p-5 flex flex-col gap-4">
              <div>
                <span className="badge badge-amber mb-2">{sourceLanguage} Source</span>
                <h2 className="text-lg font-bold text-white leading-snug line-clamp-2">
                  {metadata.title}
                </h2>
                <p className="text-slate-400 text-xs mt-1">Channel: {metadata.author}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <div>
                    <span className="text-slate-400 block">Duration</span>
                    <span className="font-semibold text-slate-200">{metadata.durationFormatted}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="text-slate-400 block">Full Conversation</span>
                    <span className="font-semibold text-slate-200">{lines.length} Lines</span>
                  </div>
                </div>
              </div>

              <a
                href={metadata.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-400 hover:text-teal-300 flex items-center justify-center gap-1 bg-slate-900/40 py-2 rounded-lg border border-slate-800 hover:border-slate-700 transition"
              >
                <span>Open on YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Dialogue Workspace */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-6">
              {/* Workspace Header Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-teal-400" />
                    <span>{(LANG_NAMES[targetLang] || 'Odia') + ' Transcript'}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 odia-text">
                    {targetLang === 'or' ? 'ଓଡ଼ିଆ ସଂଳାପ | 100% Non-Summarized' : (LANG_NAMES[targetLang] || 'Odia') + ' Dialogue | 100% Non-Summarized'}
                  </p>
                </div>

                {/* View Mode Buttons */}
                <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setViewMode('dual')}
                    className={`px-3 py-1.5 rounded-lg transition font-medium ${
                      viewMode === 'dual' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Dual Column
                  </button>
                  <button
                    onClick={() => setViewMode('odia_only')}
                    className={`px-3 py-1.5 rounded-lg transition font-medium ${
                      viewMode === 'odia_only' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {(LANG_NAMES[targetLang] || 'Odia') + ' Only'}
                  </button>
                  <button
                    onClick={() => setViewMode('monologue')}
                    className={`px-3 py-1.5 rounded-lg transition font-medium ${
                      viewMode === 'monologue' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Full Script
                  </button>
                </div>
              </div>

              {/* Action & Speaker Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-48">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search dialogue..."
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-teal-500 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 outline-none"
                    />
                  </div>

                  {/* Speaker Selector */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1.5 rounded-xl text-xs">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => setSelectedSpeaker(e.target.value)}
                      className="bg-transparent text-slate-200 outline-none text-xs cursor-pointer"
                    >
                      {speakersList.map((spk) => (
                        <option key={spk} value={spk} className="bg-slate-900 text-slate-200">
                          {spk}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={handleCopyText}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                    title="Copy dialogue text"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-teal-400" />}
                    <span>{copied ? 'Copied!' : 'Copy Text'}</span>
                  </button>

                  <button
                    onClick={() => setIsPdfModalOpen(true)}
                    className="glow-btn px-4 py-2 text-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Dialogue Items List */}
              <div className="max-h-[500px] overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
                {filteredLines.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No dialogue matching search/speaker filter
                  </div>
                ) : viewMode === 'monologue' ? (
                  /* Monologue View */
                  <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl space-y-4 leading-relaxed text-sm odia-text">
                    {filteredLines.map((line) => (
                      <div key={line.id} className="mb-3">
                        <span className="text-xs font-bold text-amber-400 mr-2 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          [{line.startFormatted}] {line.speaker}
                        </span>
                        <span className="text-slate-200">{line.odiaText}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Timeline / Dual View */
                  filteredLines.map((line) => (
                    <div
                      key={line.id}
                      className={`p-4 rounded-xl border transition flex flex-col gap-2 ${
                        selectedLineId === line.start
                          ? 'bg-slate-800/90 border-teal-500'
                          : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => seekTo(line.start)}
                            className="text-teal-400 font-mono font-semibold flex items-center gap-1 bg-teal-950/60 hover:bg-teal-900/80 border border-teal-800 px-2.5 py-1 rounded-lg transition"
                          >
                            <Play className="w-3 h-3 fill-teal-400" />
                            <span>{line.startFormatted} - {line.endFormatted}</span>
                          </button>

                          <span className="bg-amber-950/80 text-amber-300 border border-amber-800/60 px-2.5 py-0.5 rounded-md font-semibold text-[11px]">
                            {line.speaker}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-500 font-mono">#Line {line.id}</span>
                      </div>

                      {/* Content Grid */}
                      <div className={`grid ${viewMode === 'dual' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-3 pt-1`}>
                        {viewMode === 'dual' && (
                          <div className="text-xs text-slate-400 italic bg-slate-950/40 p-2.5 rounded-lg border border-slate-900">
                            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Original ({sourceLanguage})</span>
                            {line.text}
                          </div>
                        )}

                        <div className="text-sm text-slate-100 odia-text bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 relative group">
                          <span className="text-[10px] uppercase font-bold text-teal-400 block mb-1">
                            {targetLang === 'or' ? 'ଓଡ଼ିଆ ଅନୁବାଦ (Odia)' : 'English Dialogue'}
                          </span>
                          
                          {editingLineId === line.id ? (
                            <textarea
                              value={line.odiaText}
                              onChange={(e) => handleLineEdit(line.id, e.target.value)}
                              onBlur={() => setEditingLineId(null)}
                              autoFocus
                              className="w-full bg-slate-900 border border-teal-500 text-slate-100 rounded p-2 text-sm outline-none"
                              rows={2}
                            />
                          ) : (
                            <div className="flex items-start justify-between gap-2">
                              <span>{line.odiaText}</span>
                              <button
                                onClick={() => setEditingLineId(line.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-teal-400 p-1 transition"
                                title="Edit Dialogue line"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer Export Extras */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-teal-400" />
                  <span>Export options:</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportTXT}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Plain Text (.txt)</span>
                  </button>

                  <button
                    onClick={exportSRT}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Subtitles (.srt)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Download Options Modal */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col gap-5 border border-teal-500/30">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-teal-400" />
                <span>PDF Download Settings ({LANG_NAMES[targetLang] || 'Odia'})</span>
              </h3>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  PDF Document Title:
                </label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 rounded-lg p-2.5 text-xs text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  PDF Dialogue Layout:
                </label>
                <select
                  value={pdfLayout}
                  onChange={(e) => setPdfLayout(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 rounded-lg p-2.5 text-xs text-slate-100 outline-none"
                >
                  <option value="dual">Dual Column (Original + Target Translation)</option>
                  <option value="odia_only">Target Dialogue Timeline Only</option>
                  <option value="monologue">Full Monologue Paragraphs</option>
                </select>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-400">
                <p className="flex items-center gap-1.5 font-semibold text-teal-300 mb-1">
                  <Check className="w-4 h-4" />
                  {targetLang === 'or' ? 'Noto Sans Oriya Font Embedded' : `Standard ${LANG_NAMES[targetLang] || 'Odia'} PDF Engine`}
                </p>
                <p className="odia-text text-[11px]">
                  {targetLang === 'or' ? 'ସମସ୍ତ ଓଡ଼ିଆ ଅକ୍ଷର (ଓଡ଼ିଆ Script) PDF ରେ ସୁନ୍ଦର ଭାବେ ପ୍ରିଣ୍ଟ ହେବ।' : `Clean formatted ${LANG_NAMES[targetLang] || 'Odia'} PDF with timestamps and speakers.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={pdfGenerating}
                className="glow-btn px-5 py-2 text-xs flex items-center gap-2"
              >
                {pdfGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF ({targetLang.toUpperCase()})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
