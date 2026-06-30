'use client';
import React from 'react';
import { TimerTicker } from '@/components/shell/TimerTicker';
import { ThemeInitializer } from '@/components/shell/ThemeInitializer';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ThemeInitializer />
      <TimerTicker />
      {children}
    </>
  );
}
