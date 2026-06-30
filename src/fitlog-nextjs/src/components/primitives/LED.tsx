'use client';
import { motion } from 'framer-motion';
import React from 'react';

interface LEDProps {
  color?: 'yellow' | 'green' | 'red' | 'off';
  size?: 'small' | 'medium' | 'large';
  pulse?: boolean;
}

const COLOR_MAP = {
  yellow: '#f6e84a',
  green: '#3ec97a',
  red: '#e35454',
  off: '#333336',
};

const SIZE_MAP = { small: 5, medium: 8, large: 12 };

export function LED({ color = 'off', size = 'small', pulse = false }: LEDProps) {
  const hex = COLOR_MAP[color];
  const px = SIZE_MAP[size];
  const on = color !== 'off';

  return (
    <motion.div
      animate={pulse && on ? { opacity: [0.3, 1, 0.3] } : { opacity: 1 }}
      transition={pulse && on ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        background: on
          ? `radial-gradient(circle at 35% 35%, ${hex} 0%, ${hex}aa 60%, ${hex}44 100%)`
          : COLOR_MAP.off,
        boxShadow: on ? `0 0 ${px * 1.5}px ${hex}88, 0 0 ${px * 0.5}px ${hex}` : 'none',
        flexShrink: 0,
      }}
    />
  );
}
