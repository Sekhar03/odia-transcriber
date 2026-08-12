# pull_dataset.py
# Script to pull English-Odia and Hindi-English parallel datasets with T5 task prefixes
import os
import json
import random
from datasets import load_dataset

def main():
    max_subset_pairs = 5000
    output_file = "dataset/indictrans2_odia_dataset.json"
    pairs = []

    # 1. Pull English-to-Odia translation pairs
    print("[Fetch] Loading English-Odia dataset from Samanantar...")
    try:
        odia_dataset = load_dataset("ai4bharat/samanantar", "or", split="train", streaming=True)
        count = 0
        for item in odia_dataset:
            src = item.get("english", item.get("src", ""))
            tgt = item.get("odia", item.get("tgt", ""))
            if src and tgt:
                pairs.append({
                    "source": f"translate English to Odia: {src}",
                    "target": tgt
                })
                count += 1
            if count >= max_subset_pairs:
                break
        print(f"[Success] Extracted {count} English-to-Odia pairs.")
    except Exception as e:
        print(f"[Error] Failed to load Samanantar Odia: {e}. Trying OPUS fallback...")
        try:
            odia_dataset = load_dataset("opus100", "en-or", split="train", streaming=True)
            count = 0
            for item in odia_dataset:
                trans = item.get("translation", {})
                src = trans.get("en", "")
                tgt = trans.get("or", "")
                if src and tgt:
                    pairs.append({
                        "source": f"translate English to Odia: {src}",
                        "target": tgt
                    })
                    count += 1
                if count >= max_subset_pairs:
                    break
            print(f"[Success] Fallback extracted {count} English-to-Odia pairs.")
        except Exception as fe:
            print(f"[Error] Fallback failed: {fe}")

    # 2. Pull Hindi-to-English translation pairs
    print("[Fetch] Loading Hindi-English dataset from IIT Bombay / OPUS...")
    try:
        # Load Hindi-English dataset from IIT Bombay English-Hindi corpus
        hi_en_dataset = load_dataset("cfilt/iitb-english-hindi", split="train", streaming=True)
        count = 0
        for item in hi_en_dataset:
            trans = item.get("translation", {})
            src = trans.get("hi", "")
            tgt = trans.get("en", "")
            if src and tgt:
                pairs.append({
                    "source": f"translate Hindi to English: {src}",
                    "target": tgt
                })
                count += 1
            if count >= max_subset_pairs:
                break
        print(f"[Success] Extracted {count} Hindi-to-English pairs.")
    except Exception as e:
        print(f"[Error] Failed to load Hindi-English dataset: {e}")

    # Shuffle the dataset to mix the tasks during training
    random.shuffle(pairs)

    if len(pairs) == 0:
        print("[Error] No sentence pairs extracted.")
        return

    # Save to local JSON file
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)
        
    print(f"[Success] Multi-task dataset prepared! Saved {len(pairs)} mixed pairs to {output_file}!")

if __name__ == "__main__":
    main()
