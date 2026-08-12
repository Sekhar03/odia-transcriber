const fs = require('fs');
const path = require('path');

/**
 * Preprocessing & Split Automation Script
 */
function normalizeOdia(text) {
  if (!text) return '';
  return text.normalize('NFC').trim();
}

function cleanText(text) {
  if (!text) return '';
  // Unicode NFC normalization and spacing cleanup
  let normalized = normalizeOdia(text);
  // Remove consecutive repeating word sequences (ASR glitches)
  const words = normalized.split(/\s+/);
  for (let sz = 2; sz <= Math.min(10, Math.floor(words.length / 2)); sz++) {
    for (let i = 0; i <= words.length - 2 * sz; i++) {
      const w1 = words.slice(i, i + sz).join(' ').toLowerCase();
      const w2 = words.slice(i + sz, i + 2 * sz).join(' ').toLowerCase();
      if (w1 === w2) {
        words.splice(i + sz, sz);
        normalized = words.join(' ');
        return cleanText(normalized);
      }
    }
  }
  return normalized;
}

function automatePreprocessing() {
  console.log('🏁 Starting Preprocessing & Cleaning Automation Pipeline...');

  const datasetDir = path.join(__dirname, '../dataset');
  const rawDatasetPath = path.join(datasetDir, 'indictrans2_odia_dataset.json');

  if (!fs.existsSync(rawDatasetPath)) {
    console.error(`❌ Raw dataset not found at ${rawDatasetPath}. Please run generate_training_dataset.js first.`);
    return;
  }

  const rawData = JSON.parse(fs.readFileSync(rawDatasetPath, 'utf-8'));
  const processedData = [];

  // 1. Normalize and Clean data
  rawData.forEach(item => {
    const cleanedSrc = cleanText(item.source);
    const cleanedTgt = cleanText(item.target);
    if (cleanedSrc && cleanedTgt) {
      processedData.push({
        source: cleanedSrc,
        target: cleanedTgt,
        speaker: item.speaker || 'speaker_default'
      });
    }
  });

  console.log(`🧹 Cleaned & Normalized ${processedData.length} samples.`);

  // 2. Perform Grouped Speaker-Leakage-Free Train/Val/Test Split (70% / 15% / 15%)
  const speakers = [...new Set(processedData.map(d => d.speaker))];
  // Shuffle speakers
  speakers.sort(() => Math.random() - 0.5);

  const trainCount = Math.floor(speakers.length * 0.70);
  const valCount = Math.floor(speakers.length * 0.15);

  const trainSpeakers = new Set(speakers.slice(0, trainCount));
  const valSpeakers = new Set(speakers.slice(trainCount, trainCount + valCount));
  const testSpeakers = new Set(speakers.slice(trainCount + valCount));

  const trainSplit = [];
  const valSplit = [];
  const testSplit = [];

  processedData.forEach(d => {
    if (trainSpeakers.has(d.speaker)) {
      trainSplit.push(d);
    } else if (valSpeakers.has(d.speaker)) {
      valSplit.push(d);
    } else {
      testSplit.push(d);
    }
  });

  // Write out splits in standard training formats (JSONL)
  fs.writeFileSync(path.join(datasetDir, 'train.jsonl'), trainSplit.map(JSON.stringify).join('\n'), 'utf-8');
  fs.writeFileSync(path.join(datasetDir, 'val.jsonl'), valSplit.map(JSON.stringify).join('\n'), 'utf-8');
  fs.writeFileSync(path.join(datasetDir, 'test.jsonl'), testSplit.map(JSON.stringify).join('\n'), 'utf-8');

  console.log(`📦 Dataset Split Complete (Speaker-Leakage-Free):`);
  console.log(`   - train.jsonl: ${trainSplit.length} samples (${trainSpeakers.size} speakers)`);
  console.log(`   - val.jsonl: ${valSplit.length} samples (${valSpeakers.size} speakers)`);
  console.log(`   - test.jsonl: ${testSplit.length} samples (${testSpeakers.size} speakers)`);

  // 3. Generate Audio Conversion Helper script
  const shPath = path.join(__dirname, 'prepare_audio.sh');
  const shContent = `#!/bin/bash
# Downsample raw audio files to 16kHz mono wav format for ASR models
mkdir -p augmented_audio
for file in raw_audio/*.mp3 raw_audio/*.wav; do
  if [ -f "$file" ]; then
    filename=$(basename -- "$file")
    name="\${filename%.*}"
    echo "Processing $filename..."
    ffmpeg -y -i "$file" -ar 16000 -ac 1 "augmented_audio/\${name}.wav"
  fi
done
echo "✅ Audio normalization to 16kHz Mono complete."
`;
  fs.writeFileSync(shPath, shContent, { encoding: 'utf-8', mode: 0o755 });
  console.log(`✅ Generated audio preparation script at: ${shPath}`);
}

automatePreprocessing();
