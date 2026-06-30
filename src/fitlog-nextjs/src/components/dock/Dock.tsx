'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LED } from '../primitives/LED';
import { useTimerStore } from '@/lib/state/timerStore';
import { useUserStore } from '@/lib/state/userStore';

const TABS = [
  { id: 'today', label: 'TODAY', href: '/today' },
  { id: 'insights', label: 'INSIGHTS', href: '/insights' },
  { id: 'plan', label: 'PLAN', href: '/plan' },
  { id: 'more', label: 'MORE', href: '/more' },
];

export function Dock() {
  const router = useRouter();
  const pathname = usePathname();
  const { isActive: timerActive } = useTimerStore();
  const { theme } = useUserStore();
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setCurrentTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    };
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: 'var(--color-surface-2)',
      borderTop: '1px solid var(--color-rule)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    }}>
      {/* Label row */}
      <div style={{ display: 'flex', paddingTop: 6, paddingLeft: 8, paddingRight: 8, gap: 4 }}>
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <div
              key={t.id}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span style={{
                flex: '0 0 6px',
                height: 1,
                background: active ? 'var(--color-accent)' : 'var(--color-text-label)',
                opacity: active ? 0.8 : 0.3,
              }} />
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8.5,
                letterSpacing: 1.4,
                fontWeight: 700,
                color: active ? 'var(--color-accent)' : 'var(--color-text-label)',
                textShadow: active ? '0 0 4px var(--color-accent)' : 'none',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}>
                {t.label}
              </span>
              <span style={{
                flex: '0 0 6px',
                height: 1,
                background: active ? 'var(--color-accent)' : 'var(--color-text-label)',
                opacity: active ? 0.8 : 0.3,
              }} />
            </div>
          );
        })}
      </div>

      {/* Button row */}
      <div style={{ display: 'flex', paddingLeft: 8, paddingRight: 8, gap: 4, paddingBottom: 4 }}>
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <button
              key={t.id}
              onClick={() => router.push(t.href)}
              style={{
                flex: 1,
                height: 42,
                background: active
                  ? 'linear-gradient(180deg, #f6e84a 0%, #c9a23a 100%)'
                  : 'linear-gradient(145deg, #4a4a4e 0%, #38383c 35%, #28282c 100%)',
                border: '1px solid #111113',
                borderRadius: 3,
                boxShadow: active
                  ? 'inset 0 1px 0 rgba(255,255,255,0.4), 1px 3px 6px rgba(0,0,0,0.6)'
                  : `inset 1.5px 1.5px 0 rgba(255,255,255,0.20),
                     inset 0 1px 0 rgba(255,255,255,0.12),
                     inset -1px -1.5px 0 rgba(0,0,0,0.65),
                     inset 0 -2px 5px rgba(0,0,0,0.45),
                     3px 8px 16px rgba(0,0,0,0.85),
                     1px 3px 6px rgba(0,0,0,0.65)`,
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* LED dots */}
              <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
                <LED color={active ? 'red' : 'off'} size="small" />
                <LED color={active ? 'red' : 'off'} size="small" />
              </div>
              {/* Timer LED for insights/today when timer active */}
              {timerActive && (t.id === 'today' || t.id === 'insights') && !active && (
                <div style={{ position: 'absolute', top: 3, right: 3 }}>
                  <LED color="yellow" size="small" pulse={true} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer strip */}
      <div style={{
        textAlign: 'center',
        paddingBottom: 4,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 7,
        letterSpacing: 2,
        color: 'rgba(255,255,255,0.18)',
        textTransform: 'uppercase',
      }}>
        INCYTE · MDL-X7 · 04CH · {currentTime}
      </div>
    </div>
  );
}
