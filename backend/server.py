import base64
import logging
import os
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tts_engine import engine, REF_AUDIO_DIR

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="F5-TTS Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    ref_id: str
    seed: Optional[int] = None


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool


@app.get("/api/prewarm", response_model=HealthResponse)
async def prewarm() -> HealthResponse:
    if not engine.model_ready:
        _ = engine.model
    return HealthResponse(status="ok", model_loaded=engine.model_ready)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        model_loaded=engine.model_ready,
    )


@app.post("/api/upload-reference")
async def upload_reference(
    file: UploadFile = File(...),
    ref_text: str = Form(...),
) -> dict:
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        ref_voice = engine.store_reference(audio_bytes, file.filename, ref_text)
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
        raise HTTPException(status_code=404, detail=f"Reference voice '{req.ref_id}' not found")

    try:
        wav_bytes, sr = engine.generate(req.text, ref_voice, seed=req.seed)
    except Exception as e:
        log.exception("F5-TTS inference failed")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {e}")

    return {
        "audio": base64.b64encode(wav_bytes).decode("ascii"),
        "sample_rate": sr,
        "text": req.text,
        "ref_id": req.ref_id,
    }


@app.get("/api/references")
async def list_references() -> list[dict]:
    refs = []
    if os.path.isdir(REF_AUDIO_DIR):
        for entry in os.listdir(REF_AUDIO_DIR):
            if entry.endswith(".wav"):
                stem = entry[:-4]
                ref = engine.get_reference(stem)
                if ref:
                    refs.append({
                        "ref_id": ref.ref_id,
                        "filename": ref.file_name,
                        "ref_text": ref.ref_text[:100],
                    })
    return refs


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
