import { useEffect } from 'react';
import { useVoices } from 'react-text-to-speech';

interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

let voicesRef: SpeechSynthesisVoice[] = [];
let isBridgeMounted = false;
const callbacksRef = { current: {} as SpeakCallbacks };

export function DefaultTTSBridge() {
  const { voices } = useVoices();

  useEffect(() => {
    voicesRef = voices;
    isBridgeMounted = true;
    return () => {
      isBridgeMounted = false;
    };
  }, [voices]);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export function speakViaDefault(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  if (!isBridgeMounted) {
    return false;
  }

  callbacksRef.current = { onStart, onEnd };

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  let ended = false;

  const endHandler = () => {
    if (ended) return;
    ended = true;
    callbacksRef.current.onEnd?.();
    callbacksRef.current = {};
  };

  utterance.onstart = () => {
    callbacksRef.current.onStart?.();
  };

  utterance.onend = endHandler;
  utterance.onerror = endHandler;

  if (voicesRef.length > 0) {
    const voice =
      voicesRef.find((v) => v.lang.startsWith('en')) || voicesRef[0];
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);

  setTimeout(() => {
    if (!ended) {
      ended = true;
      callbacksRef.current.onEnd?.();
      callbacksRef.current = {};
    }
  }, 30000);

  return true;
}

// eslint-disable-next-line react-refresh/only-export-components
export function stopDefaultTTS(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
