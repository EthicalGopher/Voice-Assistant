import { useState, useEffect } from 'react';
import { X, Palette, Volume2, Sparkles, User, Sliders, Mic, Bot, RefreshCw, CheckCircle2, AlertCircle, Globe } from 'lucide-react';
import type { AssistantSettings, ColorThemeKey } from '../types';
import { COLOR_THEMES } from '../lib/colorThemes';
import { VoiceReferenceCapture } from './VoiceReferenceCapture';
import { ollamaClient, type OllamaStatus } from '../lib/ollamaClient';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AssistantSettings;
  backendAvailable: boolean;
  onClose: () => void;
  onUpdateSettings: (newSettings: Partial<AssistantSettings>) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  backendAvailable,
  onClose,
  onUpdateSettings,
}: SettingsModalProps) {
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    let active = true;
    if (isOpen) {
      ollamaClient.getStatus().then((status) => {
        if (active) {
          setOllamaStatus(status);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [isOpen]);

  const handleManualCheck = async () => {
    setLoadingStatus(true);
    try {
      const status = await ollamaClient.getStatus();
      setOllamaStatus(status);
    } finally {
      setLoadingStatus(false);
    }
  };

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

          {/* Backend & Ngrok Tunnel URL */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              Backend & Ngrok Tunnel URL
            </label>
            <input
              type="text"
              value={settings.customBackendUrl || ''}
              onChange={(e) => onUpdateSettings({ customBackendUrl: e.target.value })}
              placeholder="e.g. https://xxxx.ngrok-free.app or http://localhost:8000"
              className="w-full py-2.5 px-3.5 text-sm bg-white/5 rounded-lg border border-white/15 focus:outline-none focus:border-cyan-400 text-white font-mono placeholder:text-slate-500"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Paste your live <code className="px-1 py-0.5 rounded bg-white/10 text-cyan-300">ngrok http 8000</code> tunnel URL to connect a hosted frontend to your local GPU backend & Ollama!
            </p>
          </div>

          {/* Ollama AI Model Settings */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                Ollama AI Engine
              </label>
              <button
                onClick={handleManualCheck}
                disabled={loadingStatus}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition-colors"
                title="Refresh Ollama status"
              >
                <RefreshCw className={`w-3 h-3 ${loadingStatus ? 'animate-spin' : ''}`} />
                Check Status
              </button>
            </div>

            {/* Status indicator pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                {ollamaStatus?.online ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-xs text-slate-300">
                  {ollamaStatus?.online ? 'Ollama Online' : 'Ollama Unreachable'}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {ollamaStatus?.url || 'http://localhost:11434'}
              </span>
            </div>

            {/* Model input / selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-mono">
                Active Ollama Model:
              </label>
              {ollamaStatus?.online && ollamaStatus.models.length > 0 ? (
                <select
                  value={settings.ollamaModel}
                  onChange={(e) => onUpdateSettings({ ollamaModel: e.target.value })}
                  className="w-full py-2.5 px-3.5 text-sm bg-white/5 rounded-lg border border-white/15 focus:outline-none focus:border-cyan-400 text-white font-mono"
                >
                  {ollamaStatus.models.map((m) => (
                    <option key={m} value={m} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={settings.ollamaModel}
                  onChange={(e) => onUpdateSettings({ ollamaModel: e.target.value })}
                  placeholder="e.g. llama3.2, mistral, phi3"
                  className="w-full py-2.5 px-3.5 text-sm bg-white/5 rounded-lg border border-white/15 focus:outline-none focus:border-cyan-400 text-white font-mono"
                />
              )}
            </div>

            {!ollamaStatus?.online && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Run <code className="px-1 py-0.5 rounded bg-white/10 text-amber-200">ollama serve</code> and{' '}
                <code className="px-1 py-0.5 rounded bg-white/10 text-amber-200">ollama pull llama3.2</code> in your terminal to enable local AI responses.
              </p>
            )}
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
              <span className="text-xs text-slate-300">F5-TTS Voice Output</span>
              <input
                type="checkbox"
                checked={settings.speechSynthesis}
                onChange={(e) => onUpdateSettings({ speechSynthesis: e.target.checked })}
                className="w-4 h-4 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Voice Reference Capture for F5-TTS */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <label className="flex items-center gap-2 text-xs font-mono tracking-wider text-slate-400 uppercase">
              <Mic className="w-3.5 h-3.5 text-purple-400" />
              F5-TTS Voice Cloning
            </label>

            <VoiceReferenceCapture
              reference={settings.referenceVoice}
              onReferenceChange={(ref) => onUpdateSettings({ referenceVoice: ref })}
              theme={COLOR_THEMES[settings.theme]}
              backendAvailable={backendAvailable}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
