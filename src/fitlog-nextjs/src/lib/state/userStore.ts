'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../db/schema';

interface UserState {
  user: User | null;
  theme: 'dark' | 'light';
  setUser: (u: User | null) => void;
  setTheme: (t: 'dark' | 'light') => void;
  toggleTheme: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      theme: 'dark',
      setUser: (u) => set({ user: u }),
      setTheme: (t) => {
        set({ theme: t });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', t);
        }
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', next);
          }
          return { theme: next };
        }),
    }),
    { name: 'incyte:user' }
  )
);
