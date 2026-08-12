# train_model.py
# Script to fine-tune IndicTrans2 or ASR models using HuggingFace & QLoRA
# Run this on a GPU-enabled machine (e.g. Google Colab, RunPod, or local RTX GPU)

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
    model_id = "t5-small" # Open standard Seq2Seq model (fully compatible, lightweight for CPU training)
    dataset_path = "dataset/indictrans2_odia_dataset.json" # Local dataset path
    output_dir = "./results_translation"
    
    print(f"[Training] Initializing QLoRA training for: {model_id}")
    print(f"[Data] Loading dataset from: {dataset_path}")

    if not os.path.exists(dataset_path):
        print(f"[Warning] Local dataset not found at {dataset_path}. Please place your JSONL/JSON dataset there.")
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
        # Load standard model in full precision on CPU
        print("[Warning] CUDA GPU not found. Loading model in full precision on CPU...")
        model = AutoModelForSeq2SeqLM.from_pretrained(
            model_id,
            device_map="cpu",
            trust_remote_code=True
        )

    # 5. Load and Preprocess Dataset
    # Expects JSON format: [{"source": "...", "target": "..."}]
    dataset = load_dataset("json", data_files=dataset_path)
    
    def preprocess_function(examples):
        inputs = [ex for ex in examples["source"]]
        targets = [ex for ex in examples["target"]]
        
        model_inputs = tokenizer(inputs, max_length=256, truncation=True)
        labels = tokenizer(text_target=targets, max_length=256, truncation=True)
        
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    tokenized_dataset = dataset.map(
        preprocess_function, 
        batched=True, 
        remove_columns=dataset["train"].column_names
    )

    # Split dataset into Train and Val
    split_dataset = tokenized_dataset["train"].train_test_split(test_size=0.15)
    
    # 6. Training Arguments
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        learning_rate=5e-5,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        weight_decay=0.01,
        save_total_limit=3,
        num_train_epochs=3,
        predict_with_generate=True,
        fp16=False,
        bf16=(device == "cuda"), # bf16 is for CUDA only
        use_cpu=(device == "cpu"), # force CPU execution on local PC
        logging_steps=50,
        evaluation_strategy="steps",
        eval_steps=200,
        save_steps=200,
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
        tokenizer=tokenizer,
        data_collator=data_collator,
    )

    # 8. Start Training
    print("[Progress] Starting training loop...")
    trainer.train()
    
    # Save fine-tuned LoRA weights
    print(f"[Success] Training complete! Saving adapter weights to {output_dir}")
    trainer.model.save_pretrained(output_dir)

if __name__ == "__main__":
    train()
