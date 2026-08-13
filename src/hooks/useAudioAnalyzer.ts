import { useState, useEffect, useRef } from 'react';
import type { AudioData, AssistantState } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

export function useAudioAnalyzer(state: AssistantState) {
  const [audioData, setAudioData] = useState<AudioData>(() =>
    audioEngineInstance.getAudioData(state, 0)
  );

  const reqIdRef = useRef<number | null>(null);

  useEffect(() => {
    let startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const data = audioEngineInstance.getAudioData(state, elapsed);
      setAudioData(data);
      reqIdRef.current = requestAnimationFrame(tick);
    };

    reqIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (reqIdRef.current) {
        cancelAnimationFrame(reqIdRef.current);
      }
    };
  }, [state]);

  return audioData;
}
