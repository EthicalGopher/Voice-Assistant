export type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface AudioData {
  volume: number;          // 0 to 1 normalized volume
  bass: number;            // 0 to 1 low frequency energy
  mid: number;             // 0 to 1 mid frequency energy
  treble: number;          // 0 to 1 high frequency energy
  rawFrequencies: Uint8Array;
  timeDomainData: Uint8Array;
  smoothedVolume: number;
}

export type ColorThemeKey = 'cyber' | 'aurora' | 'solaris' | 'amethyst';

export interface ColorTheme {
  id: ColorThemeKey;
  name: string;
  primary: string;       // Cyan #00f0ff
  secondary: string;     // Purple #8a2be2
  accent: string;        // Magenta #ff007f
  coreGlow: string;      // Blue #0066ff
  backgroundGlow: string;// #0d1b38
  waveformColors: [string, string, string];
}

export interface AssistantSettings {
  theme: ColorThemeKey;
  bloomIntensity: number;
  particleCount: number;
  waveformHarmonics: number;
  soundEffects: boolean;
  speechSynthesis: boolean;
  sensitivity: number;
  userName: string;
  ttsProvider: 'f5tts' | 'webspeech';
  referenceVoice: VoiceReference | null;
}

export interface VoiceReference {
  refId: string;
  refText: string;
  fileName: string;
}

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
