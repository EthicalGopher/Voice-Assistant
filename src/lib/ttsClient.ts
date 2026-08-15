import type { VoiceReference } from '../types';
import { FIXED_REF_SCRIPT } from './fixedScript';
import { audioEngineInstance } from './audioEngine';
import { getApiEndpoints, fetchApi } from '../config';

export class TTSClient {
  private backendAvailable = false;
  private referenceVoice: VoiceReference | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private muted = false;

  async checkBackend(): Promise<boolean> {
    try {
      const endpoints = getApiEndpoints();
      const resp = await fetchApi(endpoints.health, {
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
    const endpoints = getApiEndpoints();
    await fetchApi(endpoints.prewarm, { method: 'GET' });
  }

  isBackendAvailable(): boolean {
    return this.backendAvailable;
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
    audioEngineInstance.stopAudio();
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
    const endpoints = getApiEndpoints();
    const form = new FormData();
    form.append('file', blob, fileName);
    form.append('ref_text', FIXED_REF_SCRIPT);

    const resp = await fetchApi(endpoints.uploadReference, {
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

    this.stop();

    try {
      await this.speakViaF5(text, onStarted, onEnded);
    } catch (e) {
      console.warn('[ttsClient] F5-TTS generation error:', e);
      onEnded?.();
    }
  }

  private async speakViaF5(
    text: string,
    onStarted?: () => void,
    onEnded?: () => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const endpoints = getApiEndpoints();
      const payload = {
        text: text,
        ref_id: this.referenceVoice?.refId || 'default',
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);

      fetchApi(endpoints.tts, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then(async (resp) => {
          clearTimeout(timeout);
          if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`TTS request failed (${resp.status}): ${err}`);
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

          // Route playback through AudioEngine to feed the real-time pitch analyzer and 3D Orb shader
          audioEngineInstance
            .playAudioWav(
              bytes,
              () => onStarted?.(),
              () => {
                onEnded?.();
                resolve();
              }
            )
            .catch((err) => {
              console.warn('[ttsClient] AudioEngine playback error:', err);
              onEnded?.();
              resolve();
            });
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
