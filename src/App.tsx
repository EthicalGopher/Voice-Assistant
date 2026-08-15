import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AssistantSettings } from './types';
import { COLOR_THEMES } from './lib/colorThemes';
import { audioEngineInstance } from './lib/audioEngine';
import { ttsClient } from './lib/ttsClient';
import { ollamaClient } from './lib/ollamaClient';
import { useAssistantUiVoice } from './hooks/useAssistantUiVoice';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';

import { AIVisualization } from './components/AIVisualization';
import { Header } from './components/Header';
import { Greeting } from './components/Greeting';
import { StatusText } from './components/StatusText';
import { TranscriptView } from './components/TranscriptView';
import { VoiceControls } from './components/VoiceControls';
import { TextInputModal } from './components/TextInputModal';
import { SettingsModal } from './components/SettingsModal';

import { getBackendUrl, setBackendUrl } from './config';

export default function App() {
  const {
    state,
    transcript,
    assistantReply,
    isSessionActive,
    startVoiceSession,
    stopVoiceSession,
    submitSpokenQuery,
    setTranscript,
    setState,
    setAssistantReply,
  } = useAssistantUiVoice();

  // Get real-time audio metrics for dynamic mic icon vibration and orb animation
  const audioData = useAudioAnalyzer(state);

  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState(false);

  const [settings, setSettings] = useState<AssistantSettings>({
    theme: 'cyber',
    bloomIntensity: 1.2,
    particleCount: 1000,
    waveformHarmonics: 4,
    soundEffects: true,
    speechSynthesis: true,
    sensitivity: 1.0,
    userName: 'Alex',
    ollamaModel: 'llama3.2',
    customBackendUrl: getBackendUrl(),
    referenceVoice: null,
  });

  // Check F5-TTS backend availability on mount
  useEffect(() => {
    ttsClient.checkBackend().then((ok) => setBackendAvailable(ok));
  }, []);

  const theme = useMemo(() => COLOR_THEMES[settings.theme] || COLOR_THEMES.cyber, [settings.theme]);

  // Handle typed directive submission via Ollama
  const handleProcessQuery = useCallback(
    async (query: string) => {
      setState('processing');
      audioEngineInstance.playSoundFx('processing');

      const result = await ollamaClient.generateResponse(query, settings.ollamaModel);
      setAssistantReply(result.reply);
      setState('speaking');
      audioEngineInstance.playSoundFx('response');

      ttsClient.speak(
        result.reply,
        () => {
          setState('speaking');
        },
        () => {
          setState('idle');
        }
      );
    },
    [setState, setAssistantReply, settings.ollamaModel]
  );

  // Toggle Voice Input / Session
  const handleToggleMic = useCallback(() => {
    if (isSessionActive) {
      stopVoiceSession();
    } else {
      startVoiceSession();
    }
  }, [isSessionActive, startVoiceSession, stopVoiceSession]);

  // Toggle Sound / Audio SFX
  const handleToggleSound = useCallback(() => {
    setIsSoundMuted((prev) => {
      const next = !prev;
      audioEngineInstance.setSoundEffects(!next);
      ttsClient.setMuted(next);
      return next;
    });
  }, []);

  // Update Preferences
  const handleUpdateSettings = (newSettings: Partial<AssistantSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (newSettings.soundEffects !== undefined) {
        audioEngineInstance.setSoundEffects(newSettings.soundEffects);
      }
      if (newSettings.customBackendUrl !== undefined) {
        setBackendUrl(newSettings.customBackendUrl);
        ttsClient.checkBackend().then((ok) => setBackendAvailable(ok));
      }
      if (newSettings.referenceVoice !== undefined) {
        ttsClient.setReference(newSettings.referenceVoice);
      }
      return updated;
    });
  };

  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);

  // Keyboard Shortcuts Listener for Push-to-Talk ('M' key hold and release)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
        e.preventDefault();
        setIsPushToTalkActive(true);
        if (!isSessionActive) {
          startVoiceSession();
        }
      } else if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleToggleMic();
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setIsTextInputOpen(true);
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        handleToggleSound();
      } else if (e.key === 'Escape') {
        setIsTextInputOpen(false);
        setIsSettingsOpen(false);
        stopVoiceSession();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsPushToTalkActive(false);
        submitSpokenQuery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSessionActive, startVoiceSession, stopVoiceSession, handleToggleMic, handleToggleSound, submitSpokenQuery]);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#05070d] text-white flex flex-col justify-between font-jakarta selection:bg-cyan-500/30 select-none">
      {/* Header Bar */}
      <Header
        userName={settings.userName}
        theme={theme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTextInput={() => setIsTextInputOpen(true)}
      />

      {/* Greeting Title */}
      <Greeting userName={settings.userName} />

      {/* Central 3D Canvas Visualization driven by RealtimeVoiceAdapter */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <AIVisualization
          state={state}
          theme={theme}
          particleCount={settings.particleCount}
        />
      </div>

      {/* Bottom Interface Overlay */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex flex-col items-center justify-end px-4 pointer-events-none">
        {/* Status text */}
        <StatusText state={state} theme={theme} isPushToTalkActive={isPushToTalkActive} />

        {/* Transcript text view */}
        <TranscriptView
          currentTranscript={transcript}
          assistantResponse={assistantReply}
          state={state}
          theme={theme}
        />

        {/* Voice Controls Pill with real-time mic vibration when user speaks */}
        <VoiceControls
          state={state}
          theme={theme}
          isSoundMuted={isSoundMuted}
          audioVolume={audioData.smoothedVolume}
          onToggleMic={handleToggleMic}
          onToggleSound={handleToggleSound}
          onOpenTextInput={() => setIsTextInputOpen(true)}
        />
      </div>

      {/* Command Input Modal */}
      <TextInputModal
        isOpen={isTextInputOpen}
        theme={theme}
        onClose={() => setIsTextInputOpen(false)}
        onSubmitPrompt={(text) => {
          setTranscript(text);
          handleProcessQuery(text);
        }}
      />

      {/* Preferences Drawer */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        backendAvailable={backendAvailable}
        onClose={() => setIsSettingsOpen(false)}
        onUpdateSettings={handleUpdateSettings}
      />
    </main>
  );
}
