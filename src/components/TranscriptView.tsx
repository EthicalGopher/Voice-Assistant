import { useMemo } from 'react';
import type { AssistantState, ColorTheme } from '../types';

interface TranscriptViewProps {
  currentTranscript: string;
  assistantResponse: string;
  state: AssistantState;
  theme: ColorTheme;
}

export function TranscriptView({
  currentTranscript,
  assistantResponse,
  state,
  theme,
}: TranscriptViewProps) {
  const defaultPrompt = "Set a reminder for my meeting with Sarah tomorrow at 2 PM and play some focus music.";

  const textToDisplay = useMemo(() => {
    if (currentTranscript) return currentTranscript;
    if (assistantResponse && (state === 'speaking' || state === 'processing')) {
      return assistantResponse;
    }
    return defaultPrompt;
  }, [currentTranscript, assistantResponse, state]);

  return (
    <div className="w-full max-w-lg mx-auto px-6 text-center my-3 min-h-[52px] flex flex-col items-center justify-center transition-all duration-500">
      <p
        className="text-sm sm:text-base font-light tracking-wide leading-relaxed transition-all duration-500 max-w-md font-jakarta"
        style={{
          color:
            currentTranscript || state === 'speaking'
              ? 'rgba(241, 245, 249, 0.95)'
              : 'rgba(148, 163, 184, 0.55)',
          textShadow:
            state === 'speaking'
              ? `0 0 15px ${theme.primary}55`
              : 'none',
        }}
      >
        “{textToDisplay}”
      </p>

      {/* Action pill summary if available during speech */}
      {assistantResponse && state === 'speaking' && (
        <span
          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono tracking-wider glass-button text-cyan-300/90 animate-fade-in"
          style={{ borderColor: `${theme.primary}44` }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          Aria Neural Stream Active
        </span>
      )}
    </div>
  );
}
