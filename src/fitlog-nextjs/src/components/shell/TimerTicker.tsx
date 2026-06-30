'use client';
import { useEffect } from 'react';
import { useTimerStore } from '@/lib/state/timerStore';

export function TimerTicker() {
  const { isActive, tick } = useTimerStore();

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isActive, tick]);

  return null;
}
