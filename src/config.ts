/**
 * Centralized Configuration Module for Aria AI Voice Assistant
 * 
 * Supports local dev, remote hosting (Vercel, Render, AWS), and Ngrok tunnels (http://localhost:8000 -> https://xxxx.ngrok-free.app).
 */

const STORAGE_KEY = 'aria_custom_backend_url';

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BACKEND_URL !== undefined) {
    const envUrl = import.meta.env.VITE_BACKEND_URL.trim();
    return envUrl.replace(/\/+$/, '');
  }
  return '';
};

export const setBackendUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned && cleaned !== 'http://localhost:8000') {
      localStorage.setItem(STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
};

export const getApiEndpoints = (baseUrl = getBackendUrl()) => {
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  return {
    health: `${cleanBase}/health`,
    prewarm: `${cleanBase}/api/prewarm`,
    chat: `${cleanBase}/api/chat`,
    tts: `${cleanBase}/api/tts`,
    uploadReference: `${cleanBase}/api/upload-reference`,
    references: `${cleanBase}/api/references`,
    ollamaStatus: `${cleanBase}/api/ollama/status`,
  };
};

/**
 * Universal fetch wrapper that automatically bypasses Ngrok free-tier browser warnings
 */
export async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', '69420');
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

export const API_ENDPOINTS = getApiEndpoints();

export const APP_CONFIG = {
  name: 'Aria AI Voice Assistant',
  getBackendUrl,
  setBackendUrl,
  getEndpoints: getApiEndpoints,
  fetchApi,
};

export default APP_CONFIG;
