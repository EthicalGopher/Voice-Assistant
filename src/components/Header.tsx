import { useState } from 'react';
import { Settings, Sparkles, Command } from 'lucide-react';
import type { ColorTheme } from '../types';

interface HeaderProps {
  userName: string;
  theme: ColorTheme;
  onOpenSettings: () => void;
  onOpenTextInput: () => void;
}

export function Header({ userName, theme, onOpenSettings, onOpenTextInput }: HeaderProps) {
  const [hoveredAvatar, setHoveredAvatar] = useState(false);

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 sm:px-12 py-6 pointer-events-auto">
      {/* Top Left: Quick command shortcut hint */}
      <button
        onClick={onOpenTextInput}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-slate-400 glass-button group hover:text-white transition-all"
        title="Press 'K' or Click to enter text command"
      >
        <Command className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-[11px] tracking-wide">Press K</span>
      </button>

      {/* Top Center: App Title */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400/80 animate-pulse" />
        <h1 className="text-xs sm:text-sm font-medium tracking-[0.25em] text-slate-300/80 uppercase font-mono">
          Aria Assistant
        </h1>
      </div>

      {/* Top Right: Settings & User Avatar Button */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-full glass-button text-slate-300 hover:text-cyan-300 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          title="Open Settings"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4 hover:rotate-45 transition-transform duration-300" />
        </button>

        <button
          onClick={onOpenSettings}
          onMouseEnter={() => setHoveredAvatar(true)}
          onMouseLeave={() => setHoveredAvatar(false)}
          className="relative group p-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
          title={`${userName}'s Profile & Preferences`}
          aria-label="User Profile"
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium text-white shadow-lg transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
              boxShadow: hoveredAvatar
                ? `0 0 20px ${theme.primary}aa`
                : '0 0 10px rgba(0,0,0,0.5)',
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#05070d] shadow-sm" />
        </button>
      </div>
    </header>
  );
}
