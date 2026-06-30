'use client';
import React from 'react';

interface SurfaceProps {
  children: React.ReactNode;
  material?: 'chassis' | 'metal' | 'plastic' | 'lcd';
  elevated?: boolean;
  inset?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const MATERIAL_STYLES: Record<string, React.CSSProperties> = {
  chassis: {
    background: 'var(--color-surface-1)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3), 3px 8px 16px rgba(0,0,0,0.6)',
  },
  metal: {
    background: 'linear-gradient(180deg, #3a3f44 0%, #1a1d20 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.5)',
  },
  plastic: {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    border: '1px solid rgba(255,255,255,0.15)',
    backdropFilter: 'blur(4px)',
  },
  lcd: {
    background: 'var(--color-well-dark)',
    border: '1px solid #2a2e33',
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.95), inset 0 0 0 1px rgba(255,255,255,0.03)',
  },
};

export function Surface({ children, material = 'chassis', elevated = false, inset = false, className, style }: SurfaceProps) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-xl)',
        ...MATERIAL_STYLES[material],
        ...(elevated ? { transform: 'translateZ(2px)' } : {}),
        ...(inset ? { boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)' } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
