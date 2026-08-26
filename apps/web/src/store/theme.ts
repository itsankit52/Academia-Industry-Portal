import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  resolve: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('aip-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('aip-theme', next);
    set({ theme: next });
    get().resolve();
  },
  setTheme: (t: Theme) => {
    localStorage.setItem('aip-theme', t);
    set({ theme: t });
    get().resolve();
  },
  resolve: () => {
    const { theme } = get();
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  },
}));
