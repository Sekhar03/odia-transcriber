# push_to_huggingface.py
# Helper script to upload your fine-tuned model weights to Hugging Face Hub
import os
from huggingface_hub import HfApi

def upload():
    model_dir = "./results_translation"
    
    if not os.path.exists(model_dir):
        print(f"[Error] Local model weights not found at {model_dir}. Please train the model first.")
        return
        
    print("--- Hugging Face Model Upload Utility ---")
    token = input("Enter your Hugging Face Write Token: ").strip()
    repo_name = input("Enter the name for your new model repository (e.g. username/t5-translation-odia): ").strip()
    
    if not token or not repo_name:
        print("[Error] Token and Repository name are required.")
        return
        
    api = HfApi()
    
    try:
        print(f"[Hub] Creating new repository: {repo_name}...")
        api.create_repo(repo_id=repo_name, token=token, private=False, exist_ok=True)
        
        print(f"[Hub] Uploading folder '{model_dir}' to Hugging Face...")
        api.upload_folder(
            folder_path=model_dir,
            repo_id=repo_name,
            token=token
        )
        print(f"\n🎉 Success! Your model is now hosted live at: https://huggingface.co/{repo_name}")
        print("You can now call this model in the cloud using Hugging Face's free Inference API!")
    except Exception as e:
        print(f"[Error] Upload failed: {e}")

if __name__ == "__main__":
    upload()
