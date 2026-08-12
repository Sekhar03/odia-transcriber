# local_translation_server.py
# A lightweight local server that exposes translation capabilities of your fine-tuned model
import os
import json
import torch
from http.server import HTTPServer, BaseHTTPRequestHandler
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_PATH = "./results_translation"
print(f"[Server] Loading local fine-tuned model from: {MODEL_PATH}")

try:
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH)
except Exception as e:
    print(f"[Warning] Failed to load local weights: {e}. Loading baseline 't5-small' model...")
    tokenizer = AutoTokenizer.from_pretrained("t5-small")
    model = AutoModelForSeq2SeqLM.from_pretrained("t5-small")

# Detect GPU or CPU
device = "cuda" if torch.cuda.is_available() else "cpu"
model = model.to(device)
print(f"[Server] Model loaded successfully on device: {device.upper()}")

class TranslationHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/translate':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data.decode('utf-8'))
            except Exception as e:
                self.send_error(400, f"Invalid JSON payload: {e}")
                return
                
            text = data.get('text', '')
            task = data.get('task', 'translate English to Odia')
            
            if not text or not text.strip():
                response = {"translatedText": ""}
            else:
                # Add T5 task prefix
                input_text = f"{task}: {text}"
                inputs = tokenizer(input_text, return_tensors="pt", max_length=256, truncation=True).to(device)
                
                with torch.no_grad():
                    outputs = model.generate(**inputs, max_length=256)
                    
                translated_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
                response = {"translatedText": translated_text}
                print(f"[Inference] Src: '{text}' -> Tgt: '{translated_text}'")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            # Enable CORS for local testing
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run(port=5002):
    server_address = ('', port)
    httpd = HTTPServer(server_address, TranslationHandler)
    print(f"[Server] Local translation service running on: http://localhost:{port} (Press Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down translation server.")
        httpd.server_close()

if __name__ == '__main__':
    run()
