import { useState, useCallback } from 'react';
import { audioEngineInstance } from '../lib/audioEngine';

export function useMicrophone() {
  const [isMicActive, setIsMicActive] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);

  const startMic = useCallback(async (): Promise<boolean> => {
    const success = await audioEngineInstance.startMicrophone();
    setIsMicActive(success);
    setMicPermissionDenied(!success);
    return success;
  }, []);

  const stopMic = useCallback(() => {
    audioEngineInstance.stopMicrophone();
    setIsMicActive(false);
  }, []);

  const toggleMic = useCallback(async (): Promise<boolean> => {
    if (isMicActive) {
      stopMic();
      return false;
    } else {
      return await startMic();
    }
  }, [isMicActive, startMic, stopMic]);

  return {
    isMicActive,
    micPermissionDenied,
    startMic,
    stopMic,
    toggleMic,
  };
}
