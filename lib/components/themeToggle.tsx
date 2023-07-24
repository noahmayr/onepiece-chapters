'use client';

import Helmet from 'react-helmet';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { WiDaySunny, WiNightClear } from 'react-icons/wi';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
}

const useThemeStore = create(
  persist<ThemeStore>(
    (set, get) => ({
      theme:
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
      toggle: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
    }),
    {
      name: 'theme', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    },
  ),
);

export default function ThemeToggle() {
  const { toggle, theme } = useThemeStore();

  return (
    <>
      <Helmet>
        <html data-theme={theme}></html>
      </Helmet>
      <button onClick={toggle} className="inline-block">
        {theme === 'dark' ? (
          <WiNightClear size={'3rem'}></WiNightClear>
        ) : (
          <WiDaySunny size={'3rem'}></WiDaySunny>
        )}
      </button>
    </>
  );
}
