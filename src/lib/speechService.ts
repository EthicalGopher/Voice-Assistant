// Web Speech API interface definitions for Speech-to-Text (STT) transcription
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
  private isFlushingOnRelease = false;
  private hasNetworkError = false;

  private onTranscriptUpdate: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onSilenceAutoSubmit: ((transcript: string) => void) | null = null;
  private onListeningEnd: (() => void) | null = null;
  
  private silenceTimer: number | null = null;
  private currentText = '';
  private silencePauseMs = 2500; // 2.5-second silence auto-submit threshold

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    if (typeof window === 'undefined') return;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };

    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interimTranscript = '';
          let finalTranscript = '';
          let hasFinalChunk = false;

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalTranscript += res[0].transcript + ' ';
              hasFinalChunk = true;
            } else {
              interimTranscript += res[0].transcript;
            }
          }

          const newText = (finalTranscript + interimTranscript).trim();
          if (newText) {
            this.currentText = newText;

            if (this.onTranscriptUpdate) {
              this.onTranscriptUpdate(newText, hasFinalChunk);
            }

            // Immediately auto-submit if Web Speech API returns isFinal chunk or start 2.5s silence countdown
            if (hasFinalChunk && finalTranscript.trim().length > 3 && !this.isFlushingOnRelease) {
              this.triggerAutoSubmit(finalTranscript.trim());
            } else {
              this.resetSilenceTimer();
            }
          }
        };

        this.recognition.onerror = (event: SpeechRecognitionErrorLike) => {
          if (event.error === 'network') {
            this.hasNetworkError = true;
            console.warn('[SpeechService] Browser Speech API network connection unavailable (speech.googleapis.com). Use text input modal or check network.');
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            console.warn('[SpeechService] Recognition error:', event.error);
          }
        };

        this.recognition.onend = () => {
          const textToSubmit = this.currentText.trim();
          if ((this.isListening || this.isFlushingOnRelease) && textToSubmit) {
            this.isFlushingOnRelease = false;
            this.triggerAutoSubmit(textToSubmit);
          } else if (this.isListening && this.recognition && !this.hasNetworkError) {
            try {
              this.recognition.start();
            } catch {
              // Ignore collision
            }
          } else {
            this.isListening = false;
            this.isFlushingOnRelease = false;
            this.clearSilenceTimer();
            if (this.onListeningEnd) {
              this.onListeningEnd();
            }
          }
        };
      } catch (err) {
        console.warn('[SpeechService] Initialization error:', err);
      }
    }
  }

  private triggerAutoSubmit(textToSubmit: string) {
    if (!textToSubmit || !this.onSilenceAutoSubmit) return;
    this.clearSilenceTimer();
    const callback = this.onSilenceAutoSubmit;
    this.currentText = '';
    this.isListening = false;
    this.isFlushingOnRelease = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
    }
    callback(textToSubmit);
  }

  public stopAndSubmit() {
    const textToSubmit = this.currentText.trim();
    this.clearSilenceTimer();

    if (textToSubmit && this.onSilenceAutoSubmit) {
      this.triggerAutoSubmit(textToSubmit);
    } else {
      // Force recognition stop so onend fires and flushes any pending audio buffer into text
      this.isFlushingOnRelease = true;
      if (this.recognition) {
        try {
          this.recognition.stop();
        } catch {
          // Ignored
        }
      }
    }
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();

    if (!this.currentText.trim()) return;

    // Start 2.5-second countdown after speech pauses
    this.silenceTimer = window.setTimeout(() => {
      if (this.currentText.trim()) {
        this.triggerAutoSubmit(this.currentText.trim());
      }
    }, this.silencePauseMs);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer !== null) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public setSilencePauseMs(ms: number) {
    this.silencePauseMs = ms;
  }

  public startListening(
    onUpdate: (transcript: string, isFinal: boolean) => void,
    onAutoSubmit: (transcript: string) => void,
    onEnd: () => void
  ): boolean {
    this.onTranscriptUpdate = onUpdate;
    this.onSilenceAutoSubmit = onAutoSubmit;
    this.onListeningEnd = onEnd;
    this.currentText = '';
    this.hasNetworkError = false;
    this.isFlushingOnRelease = false;
    this.clearSilenceTimer();

    if (this.recognition) {
      try {
        this.recognition.start();
        this.isListening = true;
        return true;
      } catch (e) {
        console.warn('[SpeechService] Error starting recognition:', e);
        return false;
      }
    }
    return false;
  }

  public stopListening() {
    this.isListening = false;
    this.isFlushingOnRelease = false;
    this.clearSilenceTimer();
    this.currentText = '';
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
    }
  }
}

export const speechServiceInstance = new SpeechService();
