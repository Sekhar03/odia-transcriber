import React, { useState, useRef } from 'react';
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
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './index.css';

const YoutubeIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

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
  { id: 'converting_to_odia', label: 'Converted to Odia' },
  { id: 'pdf_generated', label: 'PDF ready' }
];

export default function App() {
  const [url, setUrl] = useState('');
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
  const iframeRef = useRef(null);

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

  const handleTranscribe = async (targetUrl = url) => {
    const finalUrl = targetUrl.trim();
    if (!finalUrl) {
      setError('Please paste a valid YouTube video link.');
      return;
    }

    setLoading(true);
    setError(null);
    const progressTimer = simulateProgress();

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
      });

      const data = await res.json();
      clearInterval(progressTimer);

      if (!data.success) {
        throw new Error(data.error || 'Failed to transcribe YouTube video.');
      }

      setMetadata(data.metadata);
      setSourceLanguage(data.sourceLanguage);
      setLines(data.lines);
      setPdfTitle(data.metadata.title);
      setCompletedSteps(PIPELINE_STEPS.map(s => s.id));

      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 }
      });
    } catch (err) {
      clearInterval(progressTimer);
      setError(err.message || 'An error occurred during transcription.');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (sampleUrl) => {
    setUrl(sampleUrl);
    handleTranscribe(sampleUrl);
  };

  const handleLineEdit = (id, newOdiaText) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, odiaText: newOdiaText } : line))
    );
  };

  const handleCopyOdiaText = () => {
    const odiaFullText = lines.map((l) => `[${l.startFormatted}] ${l.speaker}: ${l.odiaText}`).join('\n');
    navigator.clipboard.writeText(odiaFullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadPDF = async () => {
    if (!lines || lines.length === 0) return;
    setPdfGenerating(true);

    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          lines,
          pdfLayout,
          pdfTitle: pdfTitle || metadata.title,
          sourceLanguage
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
      const cleanTitle = (pdfTitle || metadata?.title || 'YouTube_Odia_Dialogue')
        .replace(/[^\x00-\x7F]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 40) || 'YouTube_Odia_Dialogue';
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

    downloadFile(srtContent, `${metadata.title}_Odia.srt`, 'text/plain');
  };

  const exportTXT = () => {
    const txtContent = lines.map((l) => `[${l.startFormatted}] ${l.speaker}:\n${l.odiaText}`).join('\n\n');
    downloadFile(txtContent, `${metadata.title}_Odia.txt`, 'text/plain');
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
                OdiaTube AI Transcriber
              </h1>
              <span className="badge badge-teal">ଓଡ଼ିଆ PDF</span>
            </div>
            <p className="text-slate-400 text-sm md:text-base mt-1 odia-text">
              Transcribe complete YouTube dialogue (English, Hindi & Hinglish) into natural Odia PDF with speaker turns.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
          <Languages className="w-5 h-5 text-teal-400" />
          <div className="text-xs">
            <span className="text-slate-400 block">AI Speech & Translation Engine</span>
            <span className="text-teal-300 font-bold odia-text">AI4Bharat IndicConformer + IndicTrans2 1B</span>
          </div>
        </div>
      </header>

      {/* Input Section */}
      <section className="glass-panel p-6 flex flex-col gap-4">
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
                <span>Start Transcription</span>
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

        {/* Processing Pipeline Checklist */}
        {loading && (
          <div className="mt-3 bg-slate-900/90 border border-teal-500/30 rounded-xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-teal-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                Processing Pipeline:
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

        {/* Error Alert */}
        {error && (
          <div className="mt-2 bg-red-950/50 border border-red-800 text-red-300 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
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
                <span className="badge badge-amber mb-2">{sourceLanguage}</span>
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

          {/* Right Column: Odia Dialogue Workspace */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="glass-panel p-6 flex flex-col gap-6">
              {/* Workspace Header Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-teal-400" />
                    <span>Odia Transcript</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 odia-text">
                    ଓଡ଼ିଆ ସଂଳାପ | 100% Non-Summarized Conversation
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
                    Odia Only
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
                    onClick={handleCopyOdiaText}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
                    title="Copy Odia Dialogue text"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-teal-400" />}
                    <span>{copied ? 'Copied!' : 'Copy Odia'}</span>
                  </button>

                  <button
                    onClick={() => setIsPdfModalOpen(true)}
                    className="glow-btn px-4 py-2 text-xs flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Odia PDF</span>
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
                  /* Monologue Full Script View */
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
                          <span className="text-[10px] uppercase font-bold text-teal-400 block mb-1">ଓଡ଼ିଆ ଅନୁବାଦ (Odia)</span>
                          
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
                                title="Edit Odia Translation line"
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
                <span>Odia PDF Settings</span>
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
                  <option value="dual">Dual Column (Original + Odia Translation)</option>
                  <option value="odia_only">Odia Dialogue Timeline Only</option>
                  <option value="monologue">Full Odia Monologue Paragraphs</option>
                </select>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs text-slate-400">
                <p className="flex items-center gap-1.5 font-semibold text-teal-300 mb-1">
                  <Check className="w-4 h-4" />
                  Noto Sans Oriya Font Embedded
                </p>
                <p className="odia-text text-[11px]">
                  ସମସ୍ତ ଓଡ଼ିଆ ଅକ୍ଷର (ଓଡ଼ିଆ Script) PDF ରେ ସୁନ୍ଦର ଭାବେ ପ୍ରିଣ୍ଟ ହେବ।
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
                    <span>Download Odia PDF</span>
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
