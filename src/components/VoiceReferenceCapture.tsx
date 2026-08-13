import { useState, useRef, useEffect } from 'react';
import { Upload, Mic, Square, Play, Pause, Trash2, Check, RefreshCw } from 'lucide-react';
import type { ColorTheme, VoiceReference } from '../types';
import { ttsClient } from '../lib/ttsClient';
import { FIXED_REF_SCRIPT } from '../lib/fixedScript';

interface VoiceReferenceCaptureProps {
  reference: VoiceReference | null;
  onReferenceChange: (ref: VoiceReference | null) => void;
  theme: ColorTheme;
  backendAvailable: boolean;
}

type ActiveTab = 'upload' | 'record';
type RecordState = 'idle' | 'requesting' | 'recording' | 'preview';

export function VoiceReferenceCapture({
  reference,
  onReferenceChange,
  theme,
  backendAvailable,
}: VoiceReferenceCaptureProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [previewUrl]);

  const handleUploadSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const ref = await ttsClient.uploadReference(file, file.name);
      onReferenceChange(ref);
      setShowReplace(false);
      e.target.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    setRecordError(null);
    setRecordState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setRecordState('preview');
      };

      recorder.start();
      setRecordState('recording');
    } catch (err) {
      setRecordError(
        err instanceof Error ? err.message : 'Microphone access denied or unavailable',
      );
      setRecordState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordState === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const confirmRecording = async () => {
    if (!recordedBlob) return;
    setRecordError(null);
    setRecordState('recording');

    try {
      const ref = await ttsClient.uploadReference(recordedBlob, 'recording.webm');
      onReferenceChange(ref);
      setShowReplace(false);
      setRecordedBlob(null);
      setPreviewUrl(null);
      setRecordState('idle');
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : String(err));
      setRecordState('preview');
    }
  };

  const handlePreviewPlay = () => {
    if (previewUrl && audioPreviewRef.current) {
      if (previewPlaying) {
        audioPreviewRef.current.pause();
      } else {
        audioPreviewRef.current.play();
      }
    }
  };

  const handlePreviewEnded = () => {
    setPreviewPlaying(false);
  };

  const handleClear = () => {
    onReferenceChange(null);
    setShowReplace(false);
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRecordState('idle');
  };

  const handleReplace = () => {
    setShowReplace(true);
    setActiveTab('record');
  };

  const handleRemovePreview = () => {
    setRecordedBlob(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordState('idle');
  };

  if (!backendAvailable) {
    return (
      <div className="p-4 rounded-xl bg-white/5 border border-rose-500/30">
        <p className="text-xs text-rose-300">
          F5-TTS backend not reachable. Voice cloning is disabled.
          Start the backend server (cd backend && bash run.sh) to enable.
        </p>
      </div>
    );
  }

  if (reference && !showReplace) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/15">
          <div className="flex-1 truncate">
            <p className="text-xs text-slate-400">Reference Voice Active</p>
            <p className="text-sm font-medium text-slate-200 truncate">{reference.fileName}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplace}
              className="p-1.5 rounded-lg glass-button text-slate-400 hover:text-white"
              title="Replace reference voice"
              aria-label="Replace reference voice"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg glass-button text-slate-400 hover:text-rose-400"
              title="Clear reference voice"
              aria-label="Clear reference voice"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!reference && (
        <>
          <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
            <Mic className="w-3.5 h-3.5 text-cyan-400" />
            Voice Reference
          </label>
          <p className="text-xs text-slate-400">
            Upload a voice sample or record live. You will be prompted to read a fixed script —
            this text becomes the transcription reference for voice cloning.
          </p>
        </>
      )}

      {!reference && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'upload'
                ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'record'
                ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            Record Sample
          </button>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            capture="user"
            onChange={handleFileUpload}
            className="hidden"
            aria-label="Upload reference voice"
          />

          <button
            onClick={handleUploadSelect}
            disabled={uploading || !backendAvailable}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl glass-button text-slate-300 hover:text-white disabled:opacity-50 transition-all"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Choose Audio File'}
          </button>

          {uploadError && (
            <p className="text-xs text-rose-300">{uploadError}</p>
          )}
        </div>
      )}

      {activeTab === 'record' && (
        <div className="space-y-3">
          {recordState === 'idle' || recordState === 'requesting' ? (
            <>
              <div
                className="p-3 rounded-xl bg-white/5 border border-white/15"
                style={{ borderLeftColor: theme.primary }}
              >
                <p className="text-xs text-slate-400 mb-2 font-mono">
                  Read this script clearly (3+ seconds):
                </p>
                <p className="text-sm text-slate-200 font-jakarta">
                  {FIXED_REF_SCRIPT}
                </p>
              </div>

              <button
                onClick={startRecording}
                disabled={recordState === 'requesting' || !backendAvailable}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl glass-button text-slate-300 hover:text-white disabled:opacity-50 transition-all"
              >
                {recordState === 'requesting' ? (
                  <>
                    <span className="w-4 h-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Requesting Mic...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    Start Recording
                  </>
                )}
              </button>

              {recordError && (
                <p className="text-xs text-rose-300">{recordError}</p>
              )}
            </>
          ) : recordState === 'recording' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                <span className="w-3 h-3 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-sm text-rose-300 font-mono">RECORDING</span>
              </div>

              <button
                onClick={stopRecording}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-all"
              >
                <Square className="w-4 h-4" />
                Stop Recording
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <audio
                ref={audioPreviewRef}
                src={previewUrl ?? undefined}
                onPlay={() => setPreviewPlaying(true)}
                onPause={() => setPreviewPlaying(false)}
                onEnded={handlePreviewEnded}
                className="hidden"
              />

              <button
                onClick={handlePreviewPlay}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl glass-button text-slate-300 hover:text-white transition-all"
              >
                {previewPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {previewPlaying ? 'Pause Preview' : 'Play Preview'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleRemovePreview}
                  className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl glass-button text-slate-400 hover:text-white transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Re-record
                </button>
                <button
                  onClick={confirmRecording}
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <span className="w-4 h-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {uploading ? 'Uploading...' : 'Confirm'}
                </button>
              </div>

              {recordError && (
                <p className="text-xs text-rose-300">{recordError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
