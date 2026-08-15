import { useMemo } from 'react';
import type { AssistantState, ColorTheme } from '../types';

interface StatusTextProps {
  state: AssistantState;
  theme: ColorTheme;
  isPushToTalkActive?: boolean;
}

export function StatusText({ state, theme, isPushToTalkActive }: StatusTextProps) {
  const isRecording = isPushToTalkActive || state === 'listening';

  const statusLabel = useMemo(() => {
    if (isRecording) {
      return 'Recording...';
    }
    if (state === 'processing') return 'Thinking...';
    if (state === 'speaking') return 'Speaking...';
    return 'Ready (Hold M to Speak)';
  }, [state, isRecording]);

  const isActiveState = isRecording || state === 'processing' || state === 'speaking';

  return (
    <div className="flex flex-col items-center justify-center gap-1 my-2 transition-all duration-500">
      <div className="flex items-center gap-2">
        {/* Pulsing indicator dot */}
        <span
          className="w-2 h-2 rounded-full transition-all duration-300 animate-pulse"
          style={{
            backgroundColor:
              isRecording
                ? theme.primary
                : state === 'processing'
                ? theme.secondary
                : state === 'speaking'
                ? theme.accent
                : 'rgba(255, 255, 255, 0.4)',
            boxShadow: isActiveState
              ? `0 0 12px ${theme.primary}`
              : '0 0 4px rgba(255,255,255,0.2)',
          }}
        />

        <p
          className="text-base sm:text-lg font-medium tracking-wide transition-all duration-300"
          style={{
            color:
              isRecording
                ? theme.primary
                : state === 'processing'
                ? '#c084fc'
                : state === 'speaking'
                ? '#f472b6'
                : 'rgba(203, 213, 225, 0.75)',
            textShadow: isActiveState
              ? `0 0 20px ${theme.primary}aa`
              : 'none',
          }}
        >
          {statusLabel}
        </p>
      </div>
    </div>
  );
}
