'use client';
import { motion } from 'framer-motion';
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  glow?: boolean;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  fullWidth?: boolean;
}

const SIZE_STYLES = {
  small: { padding: '6px 10px', fontSize: 'var(--font-size-small)', borderRadius: 'var(--radius-tight)' },
  medium: { padding: '10px 16px', fontSize: 'var(--font-size-small)', borderRadius: 'var(--radius-md)' },
  large: { padding: '14px 24px', fontSize: 14, borderRadius: 'var(--radius-md)' },
};

export function Button({
  children, onClick, variant = 'secondary', size = 'medium',
  disabled = false, glow = false, icon, style, fullWidth = false,
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? {} : { y: 1, scale: 0.98 }}
      transition={{ duration: 0.08, ease: 'easeOut' }}
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: fullWidth ? '100%' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid #111113',
        background: variant === 'danger'
          ? 'linear-gradient(145deg, #5a2020 0%, #3c1818 35%, #2a1010 100%)'
          : 'linear-gradient(145deg, #4a4a4e 0%, #38383c 35%, #28282c 100%)',
        boxShadow: disabled ? 'none' : `
          inset 1.5px 1.5px 0 rgba(255,255,255,0.20),
          inset 0 1px 0 rgba(255,255,255,0.12),
          inset -1px -1.5px 0 rgba(0,0,0,0.65),
          inset 0 -2px 5px rgba(0,0,0,0.45),
          3px 8px 16px rgba(0,0,0,0.85),
          1px 3px 6px rgba(0,0,0,0.65)`,
        color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(245,245,240,0.85)',
        fontFamily: 'var(--font-sans)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        ...SIZE_STYLES[size],
        ...style,
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </motion.button>
  );
}
