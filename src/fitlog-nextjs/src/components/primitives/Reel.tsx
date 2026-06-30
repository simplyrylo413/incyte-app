'use client';
import { motion } from 'framer-motion';
import React from 'react';

interface ReelProps {
  spinning?: boolean;
  position?: 'left' | 'right';
  size?: number;
}

export function Reel({ spinning = false, size = 44 }: ReelProps) {
  return (
    <motion.div
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 60, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'radial-gradient(circle, #4a5055 0%, #1a1d20 100%)',
        border: '1px solid #0a0a0b',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 6px rgba(0,0,0,0.7)',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Position marker */}
      <div style={{
        position: 'absolute',
        top: 2,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 1.5,
        height: 4,
        background: 'rgba(255,255,255,0.6)',
        borderRadius: 1,
      }} />
      {/* Center hub */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: size * 0.35,
        height: size * 0.35,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #5a6065 0%, #2a2d32 50%, #0a0a0c 100%)',
        border: '1px solid #0a0a0b',
        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15)',
      }} />
      {/* Spokes */}
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <div
          key={angle}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '40%',
            height: 1,
            background: 'rgba(255,255,255,0.08)',
            transformOrigin: '0 50%',
            transform: `rotate(${angle}deg)`,
          }}
        />
      ))}
    </motion.div>
  );
}
