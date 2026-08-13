# F5-TTS Integration Plan

## Goal
Integrate F5-TTS as a backend Python (FastAPI) service that synthesizes the AI assistant's spoken responses using a user-provided reference voice. The frontend React app will let users upload or record a reference audio sample, and every AI reply (whether triggered by voice input or text input) will be spoken via F5-TTS instead of the browser's built-in Web Speech Synthesis. When TTS playback starts, the 3D AI orb animation state changes to `speaking`.

## Resolved Decisions
| Decision | Choice |
|---|---|
| Backend location | `backend/` folder in same repo, FastAPI server |
| ref_text strategy | Fixed sample script — user reads a predetermined phrase when recording/uploading reference audio |
| STT (input) | Keep existing Web Speech API (`speechService.ts`) — unchanged |
| TTS (output) | F5-TTS backend (`/api/tts`) with graceful fallback to Web Speech Synthesis if backend is down |
| Model | F5-TTS base model via `from f5_tts.api import F5TTS` |
| Voice profiles | Single global reference voice stored in settings |
| Seed | Optional, defaults to random per request; frontend can pass an explicit seed |
| Dev proxy | Vite proxy `/api` → `http://localhost:8000` in `vite.config.ts` |
| CORS | Backend allows `http://localhost:*` origins |

## Data Flow

### Voice Input Path (existing STT + new TTS)
```
User speaks → Web Speech API STT → transcript → generateAIResponse() → F5-TTS backend /api/tts → WAV audio → frontend playback
State: idle → listening → (processing) → speaking → listening
```

### Text Input Path (TextInputModal)
```
User types → generateAIResponse() → F5-TTS backend /api/tts → WAV audio → frontend playback
State: idle → processing → speaking → idle
```

### Reference Voice Setup Path
```
Settings → VoiceReferenceCapture component → (record via MediaRecorder OR upload file) → upload to /api/upload-reference with ref_text → backend stores file → returns ref_id
```

## Backend Tasks (Python)

### 1. Create `backend/requirements.txt`
```
f5-tts>=0.1.8
fastapi>=0.115
uvicorn[standard]>=0.32
python-multipart>=0.0.12
soundfile>=0.13
```

### 2. Create `backend/tts_engine.py`
- `class TTSInferenceEngine` wrapping `F5TTS()`.
- Lazy-load the model on first `generate()` call (F5-TTS downloads ~1GB weights on first run — document this).
- Method `generate(text: str, ref_file: str, ref_text: str, seed: int | None) -> tuple[bytes, int]` returning raw WAV bytes + sample rate.
- Use `soundfile.write` to convert the returned numpy/torch `wav` to 16-bit PCM WAV bytes written to a `BytesIO` buffer.
- Method `store_reference(blob: bytes, filename: str, ref_text: str) -> str` saving the audio file to `backend/ref_audios/{ref_id}.wav` and returning the ref_id.
- Method `get_reference(ref_id: str) -> tuple[str, str] | None` returning `(file_path, ref_text)` or None if not found.

### 3. Create `backend/server.py`
FastAPI app with:
- **CORS middleware**: allow origins `http://localhost:*`, `http://127.0.0.1:*`.
- **`POST /health`**: returns `{"status": "ok", "model_loaded": bool}`.
- **`POST /api/upload-reference`**: multipart form with `file` (audio) and `ref_text` (string). Calls `engine.store_reference()`, returns `{"ref_id": "...", "filename": "...", "ref_text": "..."}`.
- **`POST /api/tts`**: JSON body `{"text": str, "ref_id": str, "seed": Optional[int]}`. Looks up reference, calls `engine.generate()`, returns `{"audio": <base64-wav>, "sample_rate": int}`. Use base64 in JSON for simplicity (avoid streaming complexity).
- Global `TTSInferenceEngine` singleton initialized at module load (model loads lazily inside `generate()`).

### 4. Create `backend/.env.example`
```
HOST=0.0.0.0
PORT=8000
MODEL_CACHE_DIR=/tmp/tts_models
LOG_LEVEL=info
```

### 5. Create `backend/run.sh` (executable)
```bash
#!/bin/bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## Frontend Tasks (TypeScript/React)

### 6. Update `src/types/index.ts`
Add types:
- `VoiceReference { id: string; refText: string; fileName: string }`
- Add to `AssistantSettings`: `ttsProvider: 'f5tts' | 'webspeech'`, `referenceVoice: VoiceReference | null`

### 7. Create `src/lib/ttsClient.ts`
- `class TTSClient` providing:
  - `checkBackend(): Promise<boolean>` — pings `/api/health`.
  - `uploadReference(blob: Blob, fileName: string): Promise<VoiceReference>` — uploads audio + fixed script text to `/api/upload-reference`, returns stored reference.
  - `speak(text: string, reference: VoiceReference | null, onEnded: () => void): Promise<void>` — calls `/api/tts`, converts base64 response to WAV Blob, plays via `new Audio()` + `.src = URL.createObjectURL(blob)`. Resolves `onEnded` when `onended` fires. Falls back to `speechServiceInstance.speak()` if backend is unreachable.
  - `setSpeechSynthesisEnabled(bool: boolean)`
  - `isUsingF5TTS: boolean` — flag to expose backend status to UI.
- Export `const ttsClient = new TTSClient()`.

### 8. Create `src/components/VoiceReferenceCapture.tsx`
Props: `{ reference: VoiceReference | null; onReferenceChange: (ref: VoiceReference) => void; theme: ColorTheme }`

UI has two tabs: **Upload File** and **Record Sample**.
- **Fixed sample script** (defined inline or in `src/lib/fixedScript.ts`): a natural sentence the user reads, e.g.:
  > "Good morning, I'm your personal assistant Aria. I can help you schedule meetings, answer questions, and manage your smart home. How can I assist you today?"
- **Upload File tab**: `<input type="file" accept="audio/*">` → on select, upload via `ttsClient.uploadReference(file, file.name)` → call `onReferenceChange`.
- **Record Sample tab**: MediaRecorder flow:
  1. Show the fixed script text prominently.
  2. "Start Recording" → `navigator.mediaDevices.getUserMedia({ audio })` → `new MediaRecorder(stream)`.
  3. "Stop Recording" → collect blob, show preview (play/pause).
  4. "Confirm" → upload blob via `ttsClient.uploadReference(blob, 'recording.wav')` → call `onReferenceChange`.
  5. "Discard" → restart recording.
- Show current reference status (filename, ref_text preview, clear button).

### 9. Update `src/lib/ariaVoiceAdapter.ts`
- Import `ttsClient` from `./ttsClient`.
- In `connect()`, replace the `speechServiceInstance.speak(res.replyText, onStart, onEnd)` call with `ttsClient.speak(res.replyText, settings.getReference(), onStart, onEnd)`.
- The `ttsClient` needs access to the current reference voice — pass it via the adapter constructor or a settings getter.
- Error handling: if F5-TTS call fails, log a console.warn and fall back to `speechServiceInstance.speak()`.
- The existing `notifyMode('speaking')` and `notifyMode('listening')` callbacks are preserved so the animation state transitions remain intact.

### 10. Update `src/App.tsx`
- On mount (in a `useEffect`), call `ttsClient.checkBackend()` and store the result in a `backendAvailable` state.
- Pass `backendAvailable` to a banner/notification if the backend is down (optional but recommended).
- In `handleProcessQuery()`, replace `speechServiceInstance.speak(result.replyText, onStart, onEnd)` with `ttsClient.speak(result.replyText, settings.referenceVoice, onStart, onEnd)`.
- Update `handleUpdateSettings()` to propagate `ttsProvider` and `referenceVoice` changes to the `ttsClient` and the voice adapter.
- Add `<VoiceReferenceCapture>` into the SettingsModal section (see next task).

### 11. Update `src/components/SettingsModal.tsx`
Add a new section below "Audio Options":
- **TTS Engine selector**: radio or toggle between "F5-TTS (Neural Voice Clone)" and "Browser Speech Synthesis (Default)". Disabled/hidden if backend is unavailable.
- **Voice Reference** subsection: if `settings.referenceVoice` is null → show `<VoiceReferenceCapture>` placeholder. If set → show stored reference (filename + clear button) and a "Replace" button.
- Pass `theme` and settings-related props down to `VoiceReferenceCapture`.

### 12. Update `vite.config.ts`
Add proxy for dev server:
```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
    '/health': {
      target: 'http://localhost:8000',
      changeOrigin: true,
    },
  },
},
```

### 13. Update `src/lib/speechService.ts`
No structural changes needed — it is retained solely for STT input and as a fallback for TTS output. Add a JSDoc comment clarifying it is the fallback path.

## Development Workflow

1. **Install Python deps**:
   ```bash
   cd backend && pip install -r requirements.txt
   ```

2. **Install JS deps** (already present):
   ```bash
   npm install
   ```

3. **Run backend**:
   ```bash
   cd backend && python server.py
   # or: uvicorn server:app --reload --port 8000
   ```
   Note: First F5-TTS model load downloads ~1GB checkpoint. Document this in README.

4. **Run frontend** (existing):
   ```bash
   npm run dev
   ```

5. **Set reference voice**: Open Settings → Voice Reference → Record Sample or Upload File → read the fixed script → confirm.

6. **Test**: Type or speak a message. AI reply is synthesized via F5-TTS, audio plays, orb animation enters `speaking` state.

## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| F5-TTS model is slow (~5-10s per generation on CPU) | Show a "synthesizing..." indicator in the UI; set state to `processing` before the API call |
| Model download fails (1GB+) | Add retry logic; fall back to browser TTS; document GPU/CUDA recommendation |
| Backend not running | `checkBackend()` on app load; disable F5-TTS option in settings; auto-fallback to browser speech synthesis |
| Audio format mismatch (MP3 vs WAV) | Backend accepts any format `librosa` can load; convert all stored refs to WAV on upload |
| CORS errors in dev | Vite proxy handles `/api`; backend CORS middleware for direct access |
| Reference audio too short (< 3s) | Validate minimum duration in `VoiceReferenceCapture`; show error if < 3s |
| Seed reproducibility | Default to random seed; expose seed input in advanced settings |

## Validation Steps

1. Backend `/health` returns 200 with `model_loaded` status.
2. Upload a reference audio file → backend returns a valid `ref_id`.
3. POST `/api/tts` with a test string → receive valid base64 WAV audio.
4. Play the returned audio in a browser `<audio>` element → it sounds like the reference speaker.
5. On the frontend: with backend running, type a message → AI reply plays via F5-TTS, orb shows `speaking` state, then returns to `idle`.
6. With backend stopped, same flow falls back to browser Web Speech Synthesis.
7. Voice input path: speak a command → STT extracts text → AI response → F5-TTS playback → orb `speaking` animation.
8. `npm run lint` and `npm run build` pass without errors.

## Open Questions (Deferred)

- **Multiple voice profiles**: Current plan supports a single global reference voice. Extending to multiple profiles would require a voice selector dropdown and per-reference `ref_id` management — deferred for MVP.
- **GPU acceleration**: F5-TTS runs on CPU by default. CUDA support is automatic if a GPU is available. Documented as a recommendation, not enforced.
- **Production deployment**: No Dockerfile included in MVP. Can be added based on deployment target (Docker, serverless, or cloud VM).
