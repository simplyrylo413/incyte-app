'use client';
import React, { useEffect } from 'react';
import { Reel } from '../primitives/Reel';
import { Fader } from '../primitives/Fader';
import { useTimerStore } from '@/lib/state/timerStore';

interface RestTimerProps {
  durationSeconds: number;
  active: boolean;
  onComplete?: () => void;
  showReels?: boolean;
  showFader?: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function RestTimer({ durationSeconds, active, onComplete, showReels = true, showFader = true }: RestTimerProps) {
  const { isActive, timeRemaining, start, tick, reset } = useTimerStore();

  useEffect(() => {
    if (active && !isActive) start(durationSeconds);
    if (!active && isActive) reset();
  }, [active]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => {
      tick();
    }, 1000);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (isActive === false && timeRemaining === 0 && active) {
      onComplete?.();
    }
  }, [isActive, timeRemaining]);

  const pct = durationSeconds > 0 ? (timeRemaining / durationSeconds) * 100 : 0;

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(227,84,84,0.08) 0%, transparent 100%)',
      border: '1px solid rgba(227,84,84,0.2)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-md)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-sm)',
    }}>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--font-size-label)',
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--color-text-label)',
      }}>
        TIME REMAINING
      </span>

      <div style={{
        fontFamily: 'var(--font-retro)',
        fontSize: 'var(--font-size-headline)',
        fontWeight: 700,
        color: '#f6e84a',
        filter: 'drop-shadow(0 0 8px rgba(245,232,0,0.7))',
        textShadow: '0 0 6px rgba(246,232,74,0.8), 0 0 20px rgba(246,232,74,0.4)',
        lineHeight: 1,
      }}>
        {formatTime(timeRemaining)}
      </div>

      {(showReels || showFader) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginTop: 4 }}>
          {showReels && <Reel spinning={isActive} position="left" size={36} />}
          {showFader && (
            <Fader
              value={pct}
              onChange={() => {}}
              height={60}
              showGlow={true}
            />
          )}
          {showReels && <Reel spinning={isActive} position="right" size={36} />}
        </div>
      )}
    </div>
  );
}
