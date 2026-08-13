import { X, Palette, Volume2, Sparkles, User, Sliders } from 'lucide-react';
import type { AssistantSettings, ColorThemeKey } from '../types';
import { COLOR_THEMES } from '../lib/colorThemes';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AssistantSettings;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<AssistantSettings>) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onUpdateSettings,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const themes = Object.values(COLOR_THEMES);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg animate-fade-in">
      <div
        className="relative w-full max-w-lg p-6 sm:p-8 rounded-2xl glass-panel text-white shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto"
        style={{
          boxShadow: `0 30px 70px rgba(0,0,0,0.85), 0 0 40px ${COLOR_THEMES[settings.theme].primary}22`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-medium tracking-wide font-outfit">
              Aria Core Preferences
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* User Name */}
          <div>
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase mb-2">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              User Profile Name
            </label>
            <input
              type="text"
              value={settings.userName}
              onChange={(e) => onUpdateSettings({ userName: e.target.value })}
              className="w-full py-2.5 px-3.5 text-sm bg-white/5 rounded-lg border border-white/15 focus:outline-none focus:border-cyan-400 text-white font-jakarta"
            />
          </div>

          {/* Color Themes */}
          <div>
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase mb-3">
              <Palette className="w-3.5 h-3.5 text-purple-400" />
              Visual Theme Preset
            </label>
            <div className="grid grid-cols-2 gap-3">
              {themes.map((t) => {
                const isSelected = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onUpdateSettings({ theme: t.id as ColorThemeKey })}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-white/10 border-cyan-400 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full shrink-0 border border-white/30"
                      style={{
                        background: `linear-gradient(135deg, ${t.primary} 0%, ${t.secondary} 100%)`,
                      }}
                    />
                    <div className="truncate">
                      <p className="text-xs font-medium text-slate-200 truncate">
                        {t.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3D Graphics Adjustments */}
          <div className="space-y-4 pt-2 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Graphics & Performance
            </label>

            {/* Bloom Intensity */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                <span>Bloom Glow Intensity</span>
                <span className="font-mono text-cyan-400">{settings.bloomIntensity}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={settings.bloomIntensity}
                onChange={(e) => onUpdateSettings({ bloomIntensity: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
              />
            </div>

            {/* Particle Density */}
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                <span>3D Particle Density</span>
                <span className="font-mono text-cyan-400">{settings.particleCount}</span>
              </div>
              <input
                type="range"
                min="400"
                max="2000"
                step="200"
                value={settings.particleCount}
                onChange={(e) => onUpdateSettings({ particleCount: parseInt(e.target.value) })}
                className="w-full accent-cyan-400 bg-white/10 h-1.5 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Audio Toggles */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              Audio Options
            </label>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-slate-300">Sci-Fi Audio SFX</span>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => onUpdateSettings({ soundEffects: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-slate-300">Aria Speech Synthesis Voice</span>
              <input
                type="checkbox"
                checked={settings.speechSynthesis}
                onChange={(e) => onUpdateSettings({ speechSynthesis: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
