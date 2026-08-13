// Web Speech API interface definitions
// Used for:
//   - Speech-to-text (STT) input: startListening() transcribes user speech to text.
//   - Fallback TTS output: speak() uses the browser's SpeechSynthesis when the
//     F5-TTS backend is unavailable or the user selects "Browser TTS" in settings.
interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export class SpeechService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;
  private onTranscriptUpdate: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onListeningEnd: (() => void) | null = null;
  private speechSynthesisEnabled = true;

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };

    const SpeechRecognitionClass = windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript;
            } else {
              interimTranscript += res[0].transcript;
            }
          }

          const currentText = finalTranscript || interimTranscript;
          if (this.onTranscriptUpdate && currentText) {
            this.onTranscriptUpdate(currentText, Boolean(finalTranscript));
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorLike) => {
          console.warn('Speech recognition status/error:', event.error);
        };

        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onListeningEnd) {
            this.onListeningEnd();
          }
        };
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public startListening(
    onUpdate: (transcript: string, isFinal: boolean) => void,
    onEnd: () => void
  ): boolean {
    this.onTranscriptUpdate = onUpdate;
    this.onListeningEnd = onEnd;

    if (this.recognition) {
      try {
        this.recognition.start();
        this.isListening = true;
        return true;
      } catch (e) {
        console.warn('Error starting speech recognition:', e);
        return false;
      }
    }
    return false;
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
      this.isListening = false;
    }
  }

  public setSpeechSynthesis(enabled: boolean) {
    this.speechSynthesisEnabled = enabled;
  }

  public speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) setTimeout(onEnd, 2000);
      return;
    }

    if (!this.speechSynthesisEnabled) {
      if (onStart) onStart();
      // Simulate speaking duration based on word count
      const durationMs = Math.max(1500, (text.split(' ').length / 3) * 1000);
      setTimeout(() => {
        if (onEnd) onEnd();
      }, durationMs);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.05;

    // Pick a smooth voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) =>
        (v.name.includes('Samantha') ||
          v.name.includes('Siri') ||
          v.name.includes('Google UK English Female') ||
          v.name.includes('Natural') ||
          v.name.includes('Zira') ||
          v.name.includes('Victoria')) &&
        v.lang.startsWith('en')
    ) || voices.find((v) => v.lang.startsWith('en'));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

export const speechServiceInstance = new SpeechService();
