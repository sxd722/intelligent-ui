"""One-time setup; normal server operation uses this model offline only.
Run: python scripts/install-tool-embeddings.py
Dependencies: sentence-transformers, torch (CPU is sufficient).
"""
import os
os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
from huggingface_hub import snapshot_download

print(snapshot_download(
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    revision='e8f8c211226b894fcb81acc59f3b34ba3efd5f42',
    allow_patterns=['model.safetensors', '*.json', '*.txt', '*.model', '1_Pooling/*'],
    ignore_patterns=['onnx/*', 'openvino/*'],
))
