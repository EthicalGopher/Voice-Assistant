import { speechServiceInstance } from './speechService';
import type { VoiceReference } from '../types';
import { FIXED_REF_SCRIPT } from './fixedScript';
import { speakViaDefault, stopDefaultTTS } from './defaultTtsBridge';

export type TTSProvider = 'f5tts' | 'webspeech';

export class TTSClient {
  private backendAvailable = false;
  private provider: TTSProvider = 'f5tts';
  private referenceVoice: VoiceReference | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private muted = false;

  async checkBackend(): Promise<boolean> {
    try {
      const resp = await fetch('/health', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      this.backendAvailable = data.status === 'ok';
      if (this.backendAvailable && !data.model_loaded) {
        this.prewarm().catch((e) => console.warn('[ttsClient] prewarm failed:', e));
      }
      return this.backendAvailable;
    } catch {
      this.backendAvailable = false;
      return false;
    }
  }

  async prewarm(): Promise<void> {
    await fetch('/api/prewarm', { method: 'GET' });
  }

  getProvider(): TTSProvider {
    return this.provider;
  }

  isUsingF5TTS(): boolean {
    return this.provider === 'f5tts' && this.backendAvailable && this.referenceVoice !== null;
  }

  isBackendAvailable(): boolean {
    return this.backendAvailable;
  }

  setProvider(provider: TTSProvider): void {
    this.provider = provider;
  }

  setReference(voice: VoiceReference | null): void {
    this.referenceVoice = voice;
  }

  getReference(): VoiceReference | null {
    return this.referenceVoice;
  }

  getRefText(): string {
    return this.referenceVoice?.refText ?? FIXED_REF_SCRIPT;
  }

  stop(): void {
    stopDefaultTTS();
    speechServiceInstance.stopSpeaking();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  async uploadReference(blob: Blob, fileName: string): Promise<VoiceReference> {
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('ref_text', FIXED_REF_SCRIPT);

    const resp = await fetch('/api/upload-reference', {
      method: 'POST',
      body: form,
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Upload failed: ${err}`);
    }

    const data = await resp.json();
    const voice: VoiceReference = {
      refId: data.ref_id,
      refText: data.ref_text,
      fileName: data.filename,
    };
    this.referenceVoice = voice;
    return voice;
  }

  async speak(
    text: string,
    onStarted?: () => void,
    onEnded?: () => void,
  ): Promise<void> {
    if (this.muted) {
      setTimeout(() => {
        onEnded?.();
      }, 100);
      return;
    }

    if (this.provider === 'f5tts' && this.backendAvailable && this.referenceVoice) {
      try {
        await this.speakViaF5(text, onStarted, onEnded);
        return;
      } catch (e) {
        console.warn('[ttsClient] F5-TTS request failed, falling back to browser TTS:', e);
      }
    }
    if (speakViaDefault(text, onStarted, onEnded)) {
      return;
    }
    speechServiceInstance.speak(text, onStarted, onEnded);
  }

  private async speakViaF5(
    text: string,
    onStarted?: () => void,
    onEnded?: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const payload = {
        text: text,
        ref_id: this.referenceVoice!.refId,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then(async (resp) => {
          clearTimeout(timeout);
          if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`TTS request failed: ${resp.status} ${err}`);
          }
          return resp.json();
        })
        .then((data: { audio: string; sample_rate: number }) => {
          const binary = atob(data.audio);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);

          const audio = new Audio(url);
          this.currentAudio = audio;
          audio.onloadedmetadata = () => {
            onStarted?.();
          };
          audio.onended = () => {
            this.currentAudio = null;
            URL.revokeObjectURL(url);
            onEnded?.();
            resolve();
          };
          audio.onpause = () => {
            this.currentAudio = null;
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            this.currentAudio = null;
            URL.revokeObjectURL(url);
            onEnded?.();
            resolve();
          };
          audio.play();
        })
        .catch((err) => {
          clearTimeout(timeout);
          console.warn('[ttsClient] F5-TTS inference error:', err);
          reject(err);
        });
    });
  }
}

export const ttsClient = new TTSClient();
