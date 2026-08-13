import { useState, useEffect } from 'react';
import { useSpeech } from 'react-text-to-speech';

interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

let setTextState: ((text: string) => void) | null = null;
let stateStop: (() => void) | null = null;
const callbacksRef = { current: {} as SpeakCallbacks };

export function DefaultTTSBridge() {
  const [text, setText] = useState('');

  const { start, stop } = useSpeech({
    text,
    autoPlay: false,
    stableText: true,
    preserveUtteranceQueue: false,
    onStart: () => {
      callbacksRef.current.onStart?.();
    },
    onStop: () => {
      callbacksRef.current.onEnd?.();
      callbacksRef.current = {};
    },
  });

  useEffect(() => {
    setTextState = setText;
    stateStop = stop;
    return () => {
      setTextState = null;
      stateStop = null;
    };
  }, [setText, stop]);

  useEffect(() => {
    if (text) {
      start();
    }
  }, [text, start]);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function speakViaDefault(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): boolean {
  if (!setTextState) {
    return false;
  }
  callbacksRef.current = { onStart, onEnd };
  setTextState(text);
  return true;
}

// eslint-disable-next-line react-refresh/only-export-components
export function stopDefaultTTS(): void {
  if (stateStop) {
    stateStop();
  }
}
