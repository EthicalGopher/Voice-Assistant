import io
import os
import uuid
import shutil
import tempfile
import logging
from dataclasses import dataclass
from typing import Optional
from f5_tts.api import F5TTS

import soundfile as sf

log = logging.getLogger(__name__)

REF_AUDIO_DIR: str = os.environ.get("REF_AUDIO_DIR", os.path.join(os.path.dirname(__file__), "ref_audios"))
MIN_REF_DURATION_SEC = 3.0


@dataclass
class ReferenceVoice:
    ref_id: str
    file_path: str
    ref_text: str
    file_name: str


class TTSInferenceEngine:
    _model: Optional["F5TTS"] = None

    def __init__(self) -> None:
        os.makedirs(REF_AUDIO_DIR, exist_ok=True)

    @property
    def model_ready(self) -> bool:
        return self._model is not None

    @property
    def model(self):
        if self._model is None:
            from f5_tts.api import F5TTS
            log.info("Loading F5-TTS model (first call may take a while — downloading weights)...")
            self._model = F5TTS()
            log.info("F5-TTS model loaded successfully.")
        return self._model

    def store_reference(self, audio_bytes: bytes, file_name: str, ref_text: str) -> ReferenceVoice:
        ref_id = uuid.uuid4().hex
        ext = os.path.splitext(file_name)[1] or ".wav"
        temp_path = os.path.join(REF_AUDIO_DIR, f"_{ref_id}_raw{ext}")
        stored_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.wav")

        with open(temp_path, "wb") as f:
            f.write(audio_bytes)

        try:
            data, sr = sf.read(temp_path)
            duration = len(data) / sr
            if duration < MIN_REF_DURATION_SEC:
                os.remove(temp_path)
                raise ValueError(
                    f"Reference audio is only {duration:.1f}s — minimum {MIN_REF_DURATION_SEC}s required."
                )
            sf.write(stored_path, data, sr, format="WAV", subtype="PCM_16")
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            raise e
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        manifest_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.txt")
        with open(manifest_path, "w") as f:
            f.write(ref_text)

        log.info("Stored reference voice '%s' (%.1fs) as ref_id=%s", file_name, duration, ref_id)
        return ReferenceVoice(ref_id=ref_id, file_path=stored_path, ref_text=ref_text, file_name=file_name)

    def get_reference(self, ref_id: str) -> Optional[ReferenceVoice]:
        manifest_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.txt")
        wav_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.wav")

        if not os.path.exists(wav_path):
            return None

        if os.path.exists(manifest_path):
            with open(manifest_path, "r") as f:
                ref_text = f.read()
            file_name = f"{ref_id}.wav"
        else:
            ref_text = ""
            file_name = os.path.basename(wav_path)

        return ReferenceVoice(ref_id=ref_id, file_path=wav_path, ref_text=ref_text, file_name=file_name)

    def generate(
        self,
        text: str,
        ref_voice: ReferenceVoice,
        seed: Optional[int] = None,
    ) -> tuple[bytes, int]:
        wav, sr, _ = self.model.infer(
            ref_file=ref_voice.file_path,
            ref_text=ref_voice.ref_text,
            gen_text=text,
            seed=seed,
        )

        buf = io.BytesIO()
        sf.write(buf, wav, sr, format="WAV", subtype="PCM_16")
        buf.seek(0)
        return buf.getvalue(), sr


engine = TTSInferenceEngine()
