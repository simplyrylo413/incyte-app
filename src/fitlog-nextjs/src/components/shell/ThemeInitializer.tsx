'use client';
import { useEffect } from 'react';
import { useUserStore } from '@/lib/state/userStore';

export function ThemeInitializer() {
  const { theme } = useUserStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return null;
}
