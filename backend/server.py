import base64
import json
import logging
import os
import urllib.error
import urllib.request
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tts_engine import engine, REF_AUDIO_DIR

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

OLLAMA_BASE_URL = os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")
DEFAULT_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")

app = FastAPI(title="Aria AI Voice Backend (F5-TTS + Ollama)", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    ref_id: Optional[str] = "default"
    seed: Optional[int] = None


class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    system_prompt: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    ollama_online: bool
    default_voice_ready: bool


def query_ollama(endpoint: str, payload: Optional[Dict[str, Any]] = None, timeout: float = 60.0) -> Dict[str, Any]:
    url = f"{OLLAMA_BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if payload is not None else {}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if payload is not None else "GET")
    
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def is_ollama_online() -> bool:
    try:
        url = f"{OLLAMA_BASE_URL}/api/tags"
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False


@app.get("/api/prewarm", response_model=HealthResponse)
async def prewarm() -> HealthResponse:
    if not engine.model_ready:
        _ = engine.model
    return HealthResponse(
        status="ok",
        model_loaded=engine.model_ready,
        ollama_online=is_ollama_online(),
        default_voice_ready=engine.get_reference("default_aria") is not None,
    )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=engine.model_ready,
        ollama_online=is_ollama_online(),
        default_voice_ready=engine.get_reference("default_aria") is not None,
    )


@app.get("/api/ollama/status")
async def ollama_status() -> dict:
    try:
        data = query_ollama("/api/tags", timeout=2.0)
        models = [m.get("name") for m in data.get("models", [])]
        return {
            "online": True,
            "url": OLLAMA_BASE_URL,
            "models": models,
            "default_model": models[0] if models else DEFAULT_OLLAMA_MODEL,
        }
    except Exception as e:
        return {
            "online": False,
            "url": OLLAMA_BASE_URL,
            "models": [],
            "error": str(e),
        }


@app.post("/api/chat")
async def chat(req: ChatRequest) -> dict:
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    model_name = req.model or DEFAULT_OLLAMA_MODEL
    system_prompt = req.system_prompt or (
        "You are Aria, an advanced and friendly AI voice assistant. "
        "Keep your response natural, conversational, and concise (1 to 3 spoken sentences maximum). "
        "Do not use markdown formatting, bullet points, asterisks, or code blocks so it can be spoken smoothly."
    )

    payload = {
        "model": model_name,
        "prompt": prompt,
        "system": system_prompt,
        "stream": False,
    }

    try:
        data = query_ollama("/api/generate", payload, timeout=120.0)
        response_text = data.get("response", "").strip()
        if not response_text:
            response_text = "I received your message, but didn't get a response from the model."
        return {
            "reply": response_text,
            "model": model_name,
            "done": data.get("done", True),
        }
    except urllib.error.URLError as e:
        log.warning("Ollama connection failed at %s: %s", OLLAMA_BASE_URL, e)
        fallback_msg = (
            f"Ollama appears to be offline at {OLLAMA_BASE_URL}. "
            f"Please ensure Ollama is running ('ollama serve') with model '{model_name}' available."
        )
        return {
            "reply": fallback_msg,
            "model": model_name,
            "error": "ollama_unreachable",
        }
    except Exception as e:
        log.exception("Ollama chat generation failed")
        raise HTTPException(status_code=500, detail=f"Ollama chat generation failed: {e}")


@app.post("/api/upload-reference")
async def upload_reference(
    file: UploadFile = File(...),
    ref_text: str = Form(...),
) -> dict:
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        ref_voice = engine.store_reference(audio_bytes, file.filename or "recording.wav", ref_text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log.exception("Failed to store reference voice")
        raise HTTPException(status_code=500, detail=f"Failed to process audio: {e}")

    return {
        "ref_id": ref_voice.ref_id,
        "filename": ref_voice.file_name,
        "ref_text": ref_voice.ref_text,
        "path": ref_voice.file_path,
    }


@app.post("/api/tts")
async def tts(req: TTSRequest) -> dict:
    if not engine.model_ready:
        _ = engine.model

    ref_voice = engine.get_reference(req.ref_id)
    if ref_voice is None:
        raise HTTPException(status_code=404, detail=f"Reference voice '{req.ref_id}' not found and default voice unavailable")

    try:
        wav_bytes, sr = engine.generate(req.text, ref_voice, seed=req.seed)
    except Exception as e:
        log.exception("F5-TTS inference failed")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")

    return {
        "audio": base64.b64encode(wav_bytes).decode("ascii"),
        "sample_rate": sr,
        "text": req.text,
        "ref_id": ref_voice.ref_id,
    }


@app.get("/api/references")
async def list_references() -> List[dict]:
    refs = []
    if os.path.isdir(REF_AUDIO_DIR):
        for entry in os.listdir(REF_AUDIO_DIR):
            if entry.endswith(".wav") and not entry.startswith("_"):
                stem = entry[:-4]
                ref = engine.get_reference(stem)
                if ref:
                    refs.append({
                        "ref_id": ref.ref_id,
                        "filename": ref.file_name,
                        "ref_text": ref.ref_text[:100],
                    })
# Serve built React frontend static files
DIST_DIR = os.path.join(PROJECT_ROOT, "dist")
from fastapi.responses import FileResponse

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Do not intercept API endpoints or health check
    if full_path.startswith("api/") or full_path == "health":
        raise HTTPException(status_code=404, detail="Not found")
    
    file_path = os.path.join(DIST_DIR, full_path)
    if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(DIST_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    
    return {
        "status": "ok",
        "message": "Aria AI Backend is running. Build the frontend ('npm run build') to serve the React UI."
    }


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
