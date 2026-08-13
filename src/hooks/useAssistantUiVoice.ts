import { useState, useEffect, useCallback } from 'react';
import type { RealtimeVoiceAdapter } from '@assistant-ui/react';
import type { AssistantState } from '../types';
import { ariaRealtimeVoiceAdapter } from '../lib/ariaVoiceAdapter';
import { audioEngineInstance } from '../lib/audioEngine';
import { speechServiceInstance } from '../lib/speechService';

export function useAssistantUiVoice() {
  const [session, setSession] = useState<RealtimeVoiceAdapter.Session | null>(null);
  const [state, setState] = useState<AssistantState>('idle');
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');

  const startVoiceSession = useCallback(() => {
    if (session) {
      session.disconnect();
      setSession(null);
      setState('idle');
      return;
    }

    // Connect via RealtimeVoiceAdapter
    const activeSession = ariaRealtimeVoiceAdapter.connect();
    setSession(activeSession);
    setState('listening');

    // Subscribe to mode changes (listening vs speaking)
    activeSession.onModeChange((mode) => {
      setState(mode === 'listening' ? 'listening' : 'speaking');
    });

    // Subscribe to volume changes
    activeSession.onVolumeChange((vol) => {
      setVolume(vol);
    });

    // Subscribe to transcripts
    activeSession.onTranscript((item) => {
      if (item.role === 'user') {
        setTranscript(item.text);
      } else if (item.role === 'assistant') {
        setAssistantReply(item.text);
      }
    });

    // Subscribe to status changes
    activeSession.onStatusChange((status) => {
      if (status.type === 'ended') {
        setState('idle');
        setSession(null);
      }
    });
  }, [session]);

  const stopVoiceSession = useCallback(() => {
    if (session) {
      session.disconnect();
      setSession(null);
    }
    audioEngineInstance.stopMicrophone();
    speechServiceInstance.stopListening();
    speechServiceInstance.stopSpeaking();
    setState('idle');
  }, [session]);

  useEffect(() => {
    return () => {
      if (session) {
        session.disconnect();
      }
    };
  }, [session]);

  return {
    state,
    volume,
    transcript,
    assistantReply,
    isSessionActive: session !== null,
    startVoiceSession,
    stopVoiceSession,
    setTranscript,
    setState,
    setAssistantReply,
  };
}
