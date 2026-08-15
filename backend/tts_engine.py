import io
import os
import uuid
import logging
import subprocess
from dataclasses import dataclass
from typing import Optional
from f5_tts.api import F5TTS

import soundfile as sf

log = logging.getLogger(__name__)

REF_AUDIO_DIR: str = os.environ.get("REF_AUDIO_DIR", os.path.join(os.path.dirname(__file__), "ref_audios"))
MIN_REF_DURATION_SEC = 3.0


def convert_audio_to_wav(input_path: str, output_path: str) -> None:
    """
    Converts any audio file (webm, ogg, opus, mp3, m4a, wav, etc.) to a standardized
    24kHz 16-bit mono WAV file for F5-TTS reference cloning.
    """
    # 1. Try ffmpeg CLI
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ac", "1",
            "-ar", "24000",
            "-sample_fmt", "s16",
            output_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return
    except Exception as e:
        log.warning("ffmpeg CLI conversion failed: %s", e)

    # 2. Try torchaudio
    try:
        import torchaudio
        waveform, sr = torchaudio.load(input_path)
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        if sr != 24000:
            import torchaudio.transforms as T
            resampler = T.Resample(sr, 24000)
            waveform = resampler(waveform)
            sr = 24000
        torchaudio.save(output_path, waveform, sr, encoding="PCM_S", bits_per_sample=16)
        if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
            return
    except Exception as e:
        log.warning("torchaudio conversion failed: %s", e)

    # 3. Direct soundfile fallback
    data, sr = sf.read(input_path)
    sf.write(output_path, data, sr, format="WAV", subtype="PCM_16")


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
        ext = os.path.splitext(file_name)[1] or ".webm"
        temp_raw_path = os.path.join(REF_AUDIO_DIR, f"_{ref_id}_raw{ext}")
        stored_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.wav")

        with open(temp_raw_path, "wb") as f:
            f.write(audio_bytes)

        try:
            # Convert raw webm/opus/mp3/m4a/wav to normalized 24kHz 16-bit WAV
            convert_audio_to_wav(temp_raw_path, stored_path)

            data, sr = sf.read(stored_path)
            duration = len(data) / sr
            if duration < MIN_REF_DURATION_SEC:
                if os.path.exists(stored_path):
                    os.remove(stored_path)
                raise ValueError(
                    f"Reference audio is only {duration:.1f}s — minimum {MIN_REF_DURATION_SEC}s required."
                )
        except Exception as e:
            if os.path.exists(stored_path):
                os.remove(stored_path)
            raise e
        finally:
            if os.path.exists(temp_raw_path):
                os.remove(temp_raw_path)

        manifest_path = os.path.join(REF_AUDIO_DIR, f"{ref_id}.txt")
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(ref_text)

        log.info("Stored reference voice '%s' (%.1fs) as ref_id=%s", file_name, duration, ref_id)
        return ReferenceVoice(ref_id=ref_id, file_path=stored_path, ref_text=ref_text, file_name=file_name)

    def get_reference(self, ref_id: Optional[str] = None) -> Optional[ReferenceVoice]:
        target_id = ref_id.strip() if ref_id and ref_id.strip() and ref_id.strip() != "default" else "default_aria"
        manifest_path = os.path.join(REF_AUDIO_DIR, f"{target_id}.txt")
        wav_path = os.path.join(REF_AUDIO_DIR, f"{target_id}.wav")

        if not os.path.exists(wav_path):
            target_id = "default_aria"
            manifest_path = os.path.join(REF_AUDIO_DIR, "default_aria.txt")
            wav_path = os.path.join(REF_AUDIO_DIR, "default_aria.wav")

        if not os.path.exists(wav_path):
            # Check any available wav in ref_audios
            if os.path.isdir(REF_AUDIO_DIR):
                for f in os.listdir(REF_AUDIO_DIR):
                    if f.endswith(".wav") and not f.startswith("_"):
                        stem = f[:-4]
                        return self.get_reference(stem)
            return None

        if os.path.exists(manifest_path):
            with open(manifest_path, "r", encoding="utf-8") as f:
                ref_text = f.read().strip()
            file_name = f"{target_id}.wav"
        else:
            ref_text = "Some call me nature, others call me mother nature."
            file_name = os.path.basename(wav_path)

        return ReferenceVoice(ref_id=target_id, file_path=wav_path, ref_text=ref_text, file_name=file_name)

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
