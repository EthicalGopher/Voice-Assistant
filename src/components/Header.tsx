import { Settings } from 'lucide-react';
import type { ColorTheme } from '../types';

interface HeaderProps {
  userName: string;
  theme: ColorTheme;
  onOpenSettings: () => void;
  onOpenTextInput: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 sm:px-12 py-6 pointer-events-auto">


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

      </div>
    </header>
  );
}
