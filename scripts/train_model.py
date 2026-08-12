import os
import json
import torch
from datasets import Dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    Seq2SeqTrainingArguments,
    Seq2SeqTrainer,
    DataCollatorForSeq2Seq
)
from peft import LoraConfig, get_peft_model, TaskType

def train():
    print("=================================================================")
    # 1. Configuration & Model Setup
    # Using the distilled 200M version for fast training and low VRAM compatibility (fits on a 12GB/16GB GPU)
    model_id = "ai4bharat/indictrans2-indic-en-dist-200M"
    output_dir = "./trained_adapters"
    dataset_path = "./dataset/indictrans2_odia_dataset.json"

    print(f"🤖 Starting translation fine-tuning pipeline on: {model_id}")
    print("=================================================================")

    if not os.path.exists(dataset_path):
        print(f"❌ Error: Dataset file not found at {dataset_path}")
        return

    # Load dataset
    with open(dataset_path, "r", encoding="utf-8") as f:
        data_samples = json.load(f)
    print(f"Loaded {len(data_samples)} training translation pairs.")

    # Convert to HuggingFace Dataset format
    dataset = Dataset.from_list(data_samples)
    dataset = dataset.train_test_split(test_size=0.15, seed=42)

    # 2. Tokenizer & Model Loading
    print("Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
    
    # Load model with 8-bit precision if GPU is available to save VRAM
    device_map = "auto" if torch.cuda.is_available() else None
    load_in_8bit = torch.cuda.is_available()
    
    model = AutoModelForSeq2SeqLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        load_in_8bit=load_in_8bit,
        device_map=device_map
    )

    # 3. Apply PEFT (LoRA) configuration
    print("Configuring LoRA Adapter layers...")
    peft_config = LoraConfig(
        task_type=TaskType.SEQ_2_SEQ_LM,
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"], # target key attention modules
        lora_dropout=0.05,
        bias="none"
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    # 4. Preprocessing & Tokenization Helper
    max_length = 128
    def preprocess_function(examples):
        inputs = examples["source"]
        targets = examples["target"]
        
        # Tokenize source
        model_inputs = tokenizer(inputs, max_length=max_length, truncation=True, padding="max_length")
        
        # Tokenize target labels
        labels = tokenizer(text_target=targets, max_length=max_length, truncation=True, padding="max_length")
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    print("Tokenizing dataset...")
    tokenized_datasets = dataset.map(preprocess_function, batched=True, remove_columns=["source", "target"])

    # 5. Training Configuration
    training_args = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        evaluation_strategy="epoch",
        learning_rate=5e-5,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        weight_decay=0.01,
        save_total_limit=3,
        num_train_epochs=5,
        predict_with_generate=True,
        fp16=torch.cuda.is_available(), # Use mixed-precision training if GPU is active
        logging_steps=10,
        save_strategy="epoch",
        load_best_model_at_end=True,
        report_to="none" # Disables online dashboard reporting for local run
    )

    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["test"],
        tokenizer=tokenizer,
        data_collator=DataCollatorForSeq2Seq(tokenizer, model=model)
    )

    # 6. Execute Training
    print("🚀 Running fine-tuning loop...")
    try:
        trainer.train()
        print(f"🎉 Success! LoRA adapter weights saved to {output_dir}")
        model.save_pretrained(output_dir)
    except Exception as e:
        print(f"❌ Training aborted: {e}")
        print("\n[GPU requirement note]: Make sure you have PyTorch GPU packages installed and a compatible graphics card (e.g. RTX/A100) to execute the training loop.")

if __name__ == "__main__":
    train()
