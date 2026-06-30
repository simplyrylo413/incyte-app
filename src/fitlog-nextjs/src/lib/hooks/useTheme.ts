'use client';
import { useUserStore } from '../state/userStore';

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useUserStore();
  return { theme, setTheme, toggle: toggleTheme };
}
