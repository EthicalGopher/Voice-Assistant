import { useMemo } from 'react';
import type { AssistantState, ColorTheme } from '../types';

interface StatusTextProps {
  state: AssistantState;
  theme: ColorTheme;
}

export function StatusText({ state, theme }: StatusTextProps) {
  const statusLabel = useMemo(() => {
    switch (state) {
      case 'idle':
        return 'Ready to listen';
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center justify-center gap-1 my-2 transition-all duration-500">
      <div className="flex items-center gap-2">
        {/* Pulsing indicator dot */}
        <span
          className="w-2 h-2 rounded-full transition-all duration-300 animate-pulse"
          style={{
            backgroundColor:
              state === 'listening'
                ? theme.primary
                : state === 'processing'
                ? theme.secondary
                : state === 'speaking'
                ? theme.accent
                : 'rgba(255, 255, 255, 0.4)',
            boxShadow:
              state !== 'idle'
                ? `0 0 12px ${theme.primary}`
                : '0 0 4px rgba(255,255,255,0.2)',
          }}
        />

        <p
          className="text-base sm:text-lg font-medium tracking-wide transition-all duration-300"
          style={{
            color:
              state === 'idle'
                ? 'rgba(203, 213, 225, 0.75)'
                : state === 'listening'
                ? theme.primary
                : state === 'processing'
                ? '#c084fc'
                : '#f472b6',
            textShadow:
              state !== 'idle'
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
