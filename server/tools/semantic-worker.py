"""Local-only embedding process. JSON lines in/out; no CLI/browser access."""
import os, sys, json
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '1'
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
try:
    # Libraries sometimes print startup messages; stdout is the protocol only.
    from contextlib import redirect_stdout
    with redirect_stdout(sys.stderr):
        import torch
        from sentence_transformers import SentenceTransformer
        torch.set_num_threads(2)
        name = os.environ.get('TOOL_EMBED_MODEL', 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
        model = SentenceTransformer(name, revision='e8f8c211226b894fcb81acc59f3b34ba3efd5f42' if name == 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2' else None, local_files_only=True, device='cpu', trust_remote_code=False)
    print(json.dumps({'ready': True}), flush=True)
    for line in sys.stdin:
        try:
            request = json.loads(line)
            texts = request['texts']
            if not isinstance(texts, list) or len(texts) > 600 or any(not isinstance(t, str) or len(t) > 2000 for t in texts):
                raise ValueError('invalid embedding batch')
            vectors = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False).tolist()
            print(json.dumps({'id': request['id'], 'vectors': vectors}), flush=True)
        except Exception as error:
            print(json.dumps({'id': request.get('id'), 'error': str(error)[:300]}), flush=True)
except Exception as error:
    print(json.dumps({'error': str(error)[:500]}), flush=True)
    sys.exit(1)
