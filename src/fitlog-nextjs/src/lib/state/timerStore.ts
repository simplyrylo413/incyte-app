'use client';
import { create } from 'zustand';

interface TimerState {
  isActive: boolean;
  timeRemaining: number;
  duration: number;
  start: (seconds: number) => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  isActive: false,
  timeRemaining: 0,
  duration: 90,
  start: (seconds) => set({ isActive: true, timeRemaining: seconds, duration: seconds }),
  pause: () => set({ isActive: false }),
  reset: () => set({ isActive: false, timeRemaining: 0 }),
  tick: () =>
    set((state) => {
      const next = state.timeRemaining - 1;
      if (next <= 0) return { isActive: false, timeRemaining: 0 };
      return { timeRemaining: next };
    }),
}));
