# pull_dataset.py
# Script to programmatically pull and format 10,000 parallel translation pairs from HuggingFace
import os
import json
from datasets import load_dataset

def main():
    dataset_name = "ai4bharat/samanantar"
    lang_subset = "or" # Odia language subset
    max_pairs = 10000
    output_file = "dataset/indictrans2_odia_dataset.json"

    print(f"[Fetch] Loading dataset '{dataset_name}' (Odia subset)...")
    
    try:
        # Use streaming=True to fetch dynamically without downloading the entire 50GB file
        dataset = load_dataset(dataset_name, lang_subset, split="train", streaming=True)
        
        pairs = []
        print(f"[Fetch] Extracting first {max_pairs} sentence pairs...")
        
        for idx, item in enumerate(dataset):
            # Samanantar format has source (English/Hindi) and target (Odia) text properties
            src_text = item.get("english", item.get("src", ""))
            tgt_text = item.get("odia", item.get("tgt", ""))
            
            if not src_text or not tgt_text:
                # Handle alternative key structure if present
                src_text = item.get("src", "")
                tgt_text = item.get("tgt", "")
                
            if src_text and tgt_text:
                pairs.append({
                    "source": src_text,
                    "target": tgt_text
                })
                
            if len(pairs) >= max_pairs:
                break
                
        if len(pairs) == 0:
            raise ValueError("No valid sentence pairs extracted.")

        # Save to local JSON file
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(pairs, f, ensure_ascii=False, indent=2)
            
        print(f"[Success] Successfully pulled and saved {len(pairs)} pairs to {output_file}!")

    except Exception as e:
        print(f"[Error] Failed to load {dataset_name}: {e}")
        print("[Fallback] Trying alternative open parallel corpus (Helsinki-NLP/opus-100)...")
        try:
            # Fallback to OPUS-100 translation corpus
            dataset = load_dataset("opus100", "en-or", split="train", streaming=True)
            pairs = []
            for item in dataset:
                trans = item.get("translation", {})
                src = trans.get("en", "")
                tgt = trans.get("or", "")
                if src and tgt:
                    pairs.append({
                        "source": src,
                        "target": tgt
                    })
                if len(pairs) >= max_pairs:
                    break
            
            os.makedirs(os.path.dirname(output_file), exist_ok=True)
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(pairs, f, ensure_ascii=False, indent=2)
                
            print(f"[Success] Fallback successful! Saved {len(pairs)} OPUS-100 pairs to {output_file}!")
        except Exception as fallback_err:
            print(f"[Error] Fallback dataset failed: {fallback_err}")

if __name__ == "__main__":
    main()
