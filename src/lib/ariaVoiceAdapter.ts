import type { RealtimeVoiceAdapter } from '@assistant-ui/react';
import { audioEngineInstance } from './audioEngine';
import { speechServiceInstance } from './speechService';
import { ttsClient } from './ttsClient';
import { ollamaClient } from './ollamaClient';

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
    let isProcessing = false;

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

    const startListeningLoop = () => {
      if (options.abortSignal?.aborted || isProcessing) return;

      audioEngineInstance.startMicrophone().then(() => {
        if (options.abortSignal?.aborted || isProcessing) return;
        notifyStatus({ type: 'running' });

        if (speechServiceInstance.isSupported()) {
          speechServiceInstance.startListening(
            (text) => {
              // Live update user's spoken words in real time
              notifyTranscript({ role: 'user', text, isFinal: false });
              notifyMode('listening');
            },
            (textToSubmit) => {
              // Silence or key release detected: transition to processing (thinking) state
              isProcessing = true;
              notifyTranscript({ role: 'user', text: textToSubmit, isFinal: true });
              notifyMode('processing' as unknown as RealtimeVoiceAdapter.Mode);
              audioEngineInstance.stopMicrophone();
              audioEngineInstance.playSoundFx('processing');

              ollamaClient.generateResponse(textToSubmit).then((res) => {
                notifyTranscript({ role: 'assistant', text: res.reply, isFinal: true });
                audioEngineInstance.playSoundFx('response');

                ttsClient.speak(
                  res.reply,
                  () => notifyMode('speaking'),
                  () => {
                    isProcessing = false;
                    disconnectSession();
                  }
                );
              }).catch(() => {
                isProcessing = false;
                disconnectSession();
              });
            },
            () => {
              // Recognition ended
            }
          );
        }
      });
    };

    // Initial start
    startListeningLoop();

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
      isProcessing = true;
      if (volumeInterval !== null) {
        clearInterval(volumeInterval);
        volumeInterval = null;
      }
      audioEngineInstance.stopMicrophone();
      speechServiceInstance.stopListening();
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
        startListeningLoop();
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
