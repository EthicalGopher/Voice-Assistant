import { Keyboard, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import type { AssistantState, ColorTheme } from '../types';
import { audioEngineInstance } from '../lib/audioEngine';

interface VoiceControlsProps {
  state: AssistantState;
  theme: ColorTheme;
  isSoundMuted: boolean;
  audioVolume?: number;
  onToggleMic: () => void;
  onToggleSound: () => void;
  onOpenTextInput: () => void;
}

export function VoiceControls({
  state,
  theme,
  isSoundMuted,
  audioVolume = 0,
  onToggleMic,
  onToggleSound,
  onOpenTextInput,
}: VoiceControlsProps) {
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';

  // Determine if the user is actively speaking based on real-time audio volume threshold
  const isUserTalking = isListening && audioVolume > 0.08;

  const handleMicClick = () => {
    audioEngineInstance.playSoundFx('click');
    onToggleMic();
  };

  const handleSoundClick = () => {
    audioEngineInstance.playSoundFx('click');
    onToggleSound();
  };

  const handleKeyClick = () => {
    audioEngineInstance.playSoundFx('click');
    onOpenTextInput();
  };

  return (
    <div className="flex items-center justify-center gap-6 sm:gap-8 my-2 z-30 pointer-events-auto">
      {/* Keyboard Input Button */}
      <button
        onClick={handleKeyClick}
        className="p-3.5 rounded-full glass-button text-slate-400 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-95"
        title="Type voice command (Hotkey: K)"
        aria-label="Keyboard Command Input"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* Main Glowing Circular Microphone Button */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing Aura Rings activate ONLY when user is actively talking */}
        {isUserTalking && (
          <>
            <div
              className="absolute w-24 h-24 rounded-full animate-ping opacity-50 pointer-events-none"
              style={{
                backgroundColor: theme.primary,
                transform: `scale(${1 + audioVolume * 0.5})`,
              }}
            />
            <div
              className="absolute w-20 h-20 rounded-full animate-pulse opacity-70 pointer-events-none"
              style={{
                boxShadow: `0 0 ${30 + audioVolume * 40}px ${theme.primary}, inset 0 0 20px ${theme.secondary}`,
              }}
            />
          </>
        )}

        {/* Ambient Outer Halo */}
        <div
          className="absolute w-16 h-16 rounded-full transition-all duration-300 blur-md pointer-events-none"
          style={{
            opacity: isUserTalking ? 0.9 : isListening ? 0.4 : 0.2,
            background: isListening
              ? `radial-gradient(circle, ${theme.primary} 0%, ${theme.secondary} 100%)`
              : `radial-gradient(circle, ${theme.coreGlow} 0%, rgba(0,0,0,0) 70%)`,
          }}
        />

        {/* Primary Interactive Mic Button */}
        <button
          onClick={handleMicClick}
          className={`relative w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-150 transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
            isUserTalking ? 'animate-mic-vibrate' : ''
          }`}
          style={{
            background: isListening
              ? `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`
              : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isListening
              ? `1.5px solid ${theme.primary}`
              : '1px solid rgba(255, 255, 255, 0.18)',
            boxShadow: isUserTalking
              ? `0 0 ${35 + audioVolume * 30}px ${theme.primary}aa, 0 10px 25px rgba(0,0,0,0.5)`
              : isListening
              ? `0 0 15px ${theme.primary}66`
              : '0 10px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.2)',
          }}
          title={isListening ? 'Stop Recording (Spacebar)' : 'Start Recording (Hold M or Spacebar)'}
          aria-label={isListening ? 'Stop Recording' : 'Start Recording'}
        >
          {isListening ? (
            <MicOff
              className={`w-7 h-7 text-white drop-shadow-md transition-transform duration-100 ${
                isUserTalking ? 'scale-110' : 'scale-100'
              }`}
            />
          ) : (
            <Mic
              className="w-7 h-7 transition-all duration-300"
              style={{
                color: isSpeaking ? theme.accent : '#f1f5f9',
                filter: isListening ? `drop-shadow(0 0 8px ${theme.primary})` : 'none',
              }}
            />
          )}
        </button>
      </div>

      {/* Speaker Output / Sound Toggle Button */}
      <button
        onClick={handleSoundClick}
        className="p-3.5 rounded-full glass-button text-slate-400 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 active:scale-95"
        title={isSoundMuted ? 'Unmute Audio Synthesis (Hotkey: M)' : 'Mute Audio Synthesis (Hotkey: M)'}
        aria-label={isSoundMuted ? 'Unmute Audio' : 'Mute Audio'}
      >
        {isSoundMuted ? (
          <VolumeX className="w-5 h-5 text-rose-400" />
        ) : (
          <Volume2 className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}
