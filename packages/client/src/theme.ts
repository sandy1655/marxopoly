import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'marxopoly.theme.v1';
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage may be unavailable */
  }
  return 'dark';
}

function apply(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme): void {
  apply(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener();
}

export function toggleTheme(): void {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/** Re-assert the stored theme on the <html> element (the inline script in
 *  index.html already does this before first paint; this keeps us in sync). */
export function initTheme(): void {
  apply(getTheme());
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}
