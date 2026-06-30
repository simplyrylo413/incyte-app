'use client';
import React from 'react';

interface DisplayProps {
  value: string | number;
  unit?: string;
  label?: string;
  glow?: 'yellow' | 'green' | 'red' | 'none';
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
}

const GLOW_COLORS = {
  yellow: '#f6e84a',
  green: '#3ec97a',
  red: '#e35454',
  none: 'rgba(255,255,255,0.7)',
};

const SIZE_MAP = {
  small: { valueFontSize: 18, unitFontSize: 10, height: 48 },
  medium: { valueFontSize: 28, unitFontSize: 12, height: 64 },
  large: { valueFontSize: 42, unitFontSize: 14, height: 80 },
};

export function Display({ value, unit, label, glow = 'yellow', size = 'medium', style }: DisplayProps) {
  const color = GLOW_COLORS[glow];
  const dims = SIZE_MAP[size];

  return (
    <div
      style={{
        background: 'var(--color-well-dark)',
        border: '1px solid #2a2e33',
        borderRadius: 'var(--radius-sm)',
        boxShadow: `
          inset 0 2px 10px rgba(0,0,0,0.95),
          inset 0 0 0 1px rgba(255,255,255,0.03),
          0 1px 0 rgba(255,255,255,0.06)`,
        padding: '6px 10px',
        minHeight: dims.height,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        ...style,
      }}
    >
      {label && (
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-label)',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--color-text-label)',
          marginBottom: 2,
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: 'var(--font-retro)',
          fontSize: dims.valueFontSize,
          fontWeight: 700,
          color,
          filter: glow !== 'none' ? `drop-shadow(0 0 5px ${color}bb)` : 'none',
          textShadow: glow !== 'none' ? `0 0 6px ${color}88, 0 0 14px ${color}44` : 'none',
          lineHeight: 1,
        }}>
          {value}
        </span>
        {unit && (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: dims.unitFontSize,
            fontWeight: 600,
            color: 'var(--color-text-dim)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
