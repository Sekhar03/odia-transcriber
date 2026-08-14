# train_nllb.py
# Script to fine-tune Meta's NLLB-200-distilled-600M model on English/Hindi/Odia translation
import os
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    DataCollatorForSeq2Seq
)
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training

def train():
    # 1. Configuration
    model_id = "facebook/nllb-200-distilled-600M"
    dataset_path = "dataset/indictrans2_odia_dataset.json"
    output_dir = "./results_nllb"
    
    print(f"[Training] Initializing training for: {model_id}")
    print(f"[Data] Loading dataset from: {dataset_path}")

    if not os.path.exists(dataset_path):
        print(f"[Warning] Local dataset not found at {dataset_path}.")
        return

    # 2. Check for CUDA / GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Selected compute device: {device.upper()}")

    # 3. Load Tokenizer and Model
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    
    if device == "cuda":
        # 4-bit quantization config (CUDA only)
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16
        )
        model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True
        )
        model = prepare_model_for_kbit_training(model)
        
        # Configure LoRA adapter
        peft_config = LoraConfig(
            r=8,
            lora_alpha=16,
            target_modules=["q_proj", "v_proj"],
            lora_dropout=0.05,
            bias="none",
            task_type="SEQ_2_SEQ_LM"
        )
        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()
    else:
        print("[Warning] CUDA GPU not found. Loading model in full precision on CPU...")
        model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            device_map="cpu",
            trust_remote_code=True
        )

    # 5. Load and Preprocess Dataset
    raw_dataset = load_dataset("json", data_files=dataset_path)
    
    # CPU Safety Limit: set cpu_limit to False to train the full dataset on CPU
    cpu_limit = True 
    if device == "cpu" and cpu_limit:
        print("[CPU Mode] cpu_limit is enabled. Limiting dataset to 100 samples to ensure fast execution. Set 'cpu_limit = False' in train_nllb.py for full training.")
        raw_dataset["train"] = raw_dataset["train"].select(range(min(100, len(raw_dataset["train"]))))

    def preprocess_function(examples):
        # We need to parse NLLB specific languages and clean prefixes
        inputs = []
        targets = []
        
        # Mapping T5-style prefixes to NLLB language codes
        for src, tgt in zip(examples["source"], examples["target"]):
            if src.startswith("translate English to Odia:"):
                clean_src = src.replace("translate English to Odia:", "").strip()
                inputs.append(clean_src)
                targets.append(tgt)
            elif src.startswith("translate Hindi to English:"):
                clean_src = src.replace("translate Hindi to English:", "").strip()
                inputs.append(clean_src)
                targets.append(tgt)
            else:
                inputs.append(src)
                targets.append(tgt)
        
        # Tokenize inputs
        model_inputs = tokenizer(inputs, max_length=256, truncation=True)
        
        # Tokenize targets
        labels = tokenizer(text_target=targets, max_length=256, truncation=True)
        
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    tokenized_dataset = raw_dataset.map(
        preprocess_function, 
        batched=True, 
        remove_columns=raw_dataset["train"].column_names
    )

    # Split dataset into Train and Val
    split_dataset = tokenized_dataset["train"].train_test_split(test_size=0.15)
    
    # 6. Training Arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        learning_rate=5e-5,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        weight_decay=0.01,
        save_total_limit=2,
        num_train_epochs=3,
        predict_with_generate=True,
        fp16=False,
        bf16=(device == "cuda"), 
        use_cpu=(device == "cpu"), 
        logging_steps=10,
        eval_strategy="steps",
        eval_steps=50,
        save_steps=50,
        gradient_accumulation_steps=4,
        report_to="none"
    )

    # 7. Trainer setup
    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model)
    
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=split_dataset["train"],
        eval_dataset=split_dataset["test"],
        processing_class=tokenizer,
        data_collator=data_collator,
    )

    # 8. Start Training
    print("[Progress] Starting NLLB training loop...")
    trainer.train()
    
    # Save fine-tuned weights
    print(f"[Success] Training complete! Saving adapter weights to {output_dir}")
    trainer.model.save_pretrained(output_dir)

if __name__ == "__main__":
    train()
