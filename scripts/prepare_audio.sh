#!/bin/bash
# Downsample raw audio files to 16kHz mono wav format for ASR models
mkdir -p augmented_audio
for file in raw_audio/*.mp3 raw_audio/*.wav; do
  if [ -f "$file" ]; then
    filename=$(basename -- "$file")
    name="${filename%.*}"
    echo "Processing $filename..."
    ffmpeg -y -i "$file" -ar 16000 -ac 1 "augmented_audio/${name}.wav"
  fi
done
echo "✅ Audio normalization to 16kHz Mono complete."
