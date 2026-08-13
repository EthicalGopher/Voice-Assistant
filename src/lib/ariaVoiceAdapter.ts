import type { RealtimeVoiceAdapter } from '@assistant-ui/react';
import { audioEngineInstance } from './audioEngine';
import { speechServiceInstance } from './speechService';
import { ttsClient } from './ttsClient';
import { generateAIResponse } from './aiResponses';

export class AriaRealtimeVoiceAdapter implements RealtimeVoiceAdapter {
  public connect(options: { abortSignal?: AbortSignal } = {}): RealtimeVoiceAdapter.Session {
    let currentStatus: RealtimeVoiceAdapter.Status = { type: 'starting' };
    let currentMode: RealtimeVoiceAdapter.Mode = 'listening';
    let isMuted = false;

    const statusListeners = new Set<(status: RealtimeVoiceAdapter.Status) => void>();
    const transcriptListeners = new Set<(item: RealtimeVoiceAdapter.TranscriptItem) => void>();
    const modeListeners = new Set<(mode: RealtimeVoiceAdapter.Mode) => void>();
    const volumeListeners = new Set<(vol: number) => void>();

    let volumeInterval: number | null = null;

    const notifyStatus = (status: RealtimeVoiceAdapter.Status) => {
      currentStatus = status;
      statusListeners.forEach((cb) => cb(status));
    };

    const notifyMode = (mode: RealtimeVoiceAdapter.Mode) => {
      currentMode = mode;
      modeListeners.forEach((cb) => cb(mode));
    };

    const notifyTranscript = (item: RealtimeVoiceAdapter.TranscriptItem) => {
      transcriptListeners.forEach((cb) => cb(item));
    };

    // Start audio & speech engines
    audioEngineInstance.startMicrophone().then(() => {
      if (options.abortSignal?.aborted) return;
      notifyStatus({ type: 'running' });

      if (speechServiceInstance.isSupported()) {
        speechServiceInstance.startListening(
          (text, isFinal) => {
            notifyTranscript({ role: 'user', text, isFinal });
            notifyMode('listening');

            if (isFinal) {
              // Trigger AI response synthesis
              notifyMode('speaking');
              const res = generateAIResponse(text);
              notifyTranscript({ role: 'assistant', text: res.replyText, isFinal: true });

              ttsClient.speak(
                res.replyText,
                () => notifyMode('speaking'),
                () => notifyMode('listening')
              );
            }
          },
          () => {
            // Speech recognition ended
          }
        );
      }
    });

    // Periodically report volume changes for visualizations
    volumeInterval = window.setInterval(() => {
      const data = audioEngineInstance.getAudioData(
        currentMode === 'listening' ? 'listening' : 'speaking',
        performance.now() / 1000
      );
      volumeListeners.forEach((cb) => cb(data.smoothedVolume));
    }, 50);

    // Abort listener
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        disconnectSession();
      });
    }

    const disconnectSession = () => {
      if (volumeInterval !== null) {
        clearInterval(volumeInterval);
        volumeInterval = null;
      }
       audioEngineInstance.stopMicrophone();
      speechServiceInstance.stopListening();
      speechServiceInstance.stopSpeaking();
      ttsClient.stop();
      notifyStatus({ type: 'ended', reason: 'finished' });
    };

    const session: RealtimeVoiceAdapter.Session = {
      get status() {
        return currentStatus;
      },
      get isMuted() {
        return isMuted;
      },
      disconnect: disconnectSession,
      mute: () => {
        isMuted = true;
      audioEngineInstance.stopMicrophone();
        speechServiceInstance.stopListening();
      },
      unmute: () => {
        isMuted = false;
        audioEngineInstance.startMicrophone();
      },
      onStatusChange: (cb) => {
        statusListeners.add(cb);
        cb(currentStatus);
        return () => statusListeners.delete(cb);
      },
      onTranscript: (cb) => {
        transcriptListeners.add(cb);
        return () => transcriptListeners.delete(cb);
      },
      onModeChange: (cb) => {
        modeListeners.add(cb);
        cb(currentMode);
        return () => modeListeners.delete(cb);
      },
      onVolumeChange: (cb) => {
        volumeListeners.add(cb);
        return () => volumeListeners.delete(cb);
      },
    };

    return session;
  }
}

export const ariaRealtimeVoiceAdapter = new AriaRealtimeVoiceAdapter();
