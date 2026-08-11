import json
import os

"""
AI4Bharat IndicTrans2 1B & IndicConformer 600M Fine-Tuning Script
Models:
- Speech-to-Text: ai4bharat/indic-conformer-600m-multilingual
- English -> Odia: ai4bharat/indictrans2-en-indic-1B
- Hindi/Indic -> Odia: ai4bharat/indictrans2-indic-indic-1B
- Smaller Model: ai4bharat/indictrans2-indic-indic-dist-320M
"""

print("=================================================================")
print("🤖 AI4Bharat IndicTrans2 1B & IndicConformer Fine-Tuning Pipeline")
print("=================================================================")

dataset_path = os.path.join(os.path.dirname(__file__), '../dataset/indictrans2_odia_dataset.json')

if os.path.exists(dataset_path):
    with open(dataset_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"Loaded {len(data)} training sample pairs from {dataset_path}")
    print("\nSample Pair 1:")
    print("Source:", data[0]['source'])
    print("Target:", data[0]['target'])

print("\nModel Architecture Sequence:")
print("YouTube Video → IndicConformer 600M ASR → English/Hindi/Hinglish Transcript → IndicTrans2 1B → Natural Odia Script → Odia PDF")
