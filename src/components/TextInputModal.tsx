import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, CornerDownLeft } from 'lucide-react';
import type { ColorTheme } from '../types';
import { SAMPLE_PROMPTS } from '../lib/aiResponses';

interface TextInputModalProps {
  isOpen: boolean;
  theme: ColorTheme;
  onClose: () => void;
  onSubmitPrompt: (text: string) => void;
}

export function TextInputModal({
  isOpen,
  theme,
  onClose,
  onSubmitPrompt,
}: TextInputModalProps) {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setInputVal('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSubmitPrompt(inputVal.trim());
      onClose();
    }
  };

  const handleSelectSample = (sample: string) => {
    onSubmitPrompt(sample);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl p-6 rounded-2xl glass-panel text-white shadow-2xl border border-white/10"
        style={{ boxShadow: `0 25px 60px rgba(0,0,0,0.8), 0 0 30px ${theme.primary}22` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-medium tracking-wide font-outfit">
              Neural Command Line
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask Aria anything or type a directive..."
              className="w-full py-3.5 pl-4 pr-12 text-sm bg-white/5 rounded-xl border border-white/15 focus:outline-none focus:border-cyan-400 text-slate-100 placeholder:text-slate-500 font-jakarta transition-all"
            />
            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="absolute right-2 p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-30 disabled:hover:bg-cyan-500 transition-all"
              title="Submit directive"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Sample Directives */}
        <div className="mt-6">
          <p className="text-xs font-mono tracking-wider text-slate-400 uppercase mb-3">
            Quick Directives:
          </p>
          <div className="flex flex-col gap-2">
            {SAMPLE_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectSample(prompt)}
                className="group flex items-center justify-between text-left p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-cyan-200 transition-all"
              >
                <span className="line-clamp-1">{prompt}</span>
                <CornerDownLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
