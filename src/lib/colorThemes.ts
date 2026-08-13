import type { ColorTheme, ColorThemeKey } from '../types';

export const COLOR_THEMES: Record<ColorThemeKey, ColorTheme> = {
  cyber: {
    id: 'cyber',
    name: 'Aria Cyan & Violet (Default)',
    primary: '#00f0ff',      // Neon Cyan
    secondary: '#8a2be2',    // Purple / Violet
    accent: '#ff007f',       // Magenta
    coreGlow: '#0066ff',     // Electric Blue
    backgroundGlow: '#0a1628',
    waveformColors: ['#00f0ff', '#8a2be2', '#ff007f'],
  },
  aurora: {
    id: 'aurora',
    name: 'Emerald Aurora',
    primary: '#00ffaa',      // Mint Neon
    secondary: '#00bfff',    // Deep Sky Blue
    accent: '#7000ff',       // Deep Indigo
    coreGlow: '#00e5ff',     // Bright Cyan
    backgroundGlow: '#051f18',
    waveformColors: ['#00ffaa', '#00e5ff', '#7000ff'],
  },
  solaris: {
    id: 'solaris',
    name: 'Solar Flare',
    primary: '#ff8800',      // Neon Orange
    secondary: '#ff0055',    // Crimson
    accent: '#ffd700',       // Gold
    coreGlow: '#ff4500',     // Orange Red
    backgroundGlow: '#220d05',
    waveformColors: ['#ffd700', '#ff8800', '#ff0055'],
  },
  amethyst: {
    id: 'amethyst',
    name: 'Cosmic Amethyst',
    primary: '#e056fd',      // Bright Magenta Pink
    secondary: '#686de0',    // Lavender Blue
    accent: '#f0932b',       // Amber
    coreGlow: '#be2edd',     // Purple
    backgroundGlow: '#1a0928',
    waveformColors: ['#e056fd', '#686de0', '#f0932b'],
  },
};
