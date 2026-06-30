'use client';
import React from 'react';
import { useTheme } from '@/lib/hooks/useTheme';
import { Button } from '../primitives/Button';
import { LED } from '../primitives/LED';

export function MoreScreen() {
  const { theme, toggle } = useTheme();

  return (
    <div style={{ padding: 'var(--space-md)', paddingTop: 'var(--space-lg)' }}>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--color-text-label)',
        marginBottom: 6,
      }}>
        SYSTEM CONFIG
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 24,
        fontWeight: 800,
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-xl)',
        letterSpacing: '-0.01em',
      }}>
        Settings
      </div>

      {/* Theme toggle */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-rule)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        marginBottom: 'var(--space-md)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-rule)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              Display Mode
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-label)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
              {theme === 'dark' ? 'DARK CHASSIS' : 'LIGHT CHASSIS'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LED color={theme === 'dark' ? 'yellow' : 'off'} size="small" />
            <Button size="small" onClick={toggle}>
              {theme === 'dark' ? '☀ LIGHT' : '● DARK'}
            </Button>
          </div>
        </div>

        <div style={{ padding: '14px 16px' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            AI Assist
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-label)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
            Toggle per-movement in workout mode
          </div>
        </div>
      </div>

      {/* Build info */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: 'var(--color-text-dim)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        textAlign: 'center',
        padding: 'var(--space-lg)',
      }}>
        INCYTE · MDL-X7 · BUILD 2.0<br />
        Progressive Overload System
      </div>
    </div>
  );
}
