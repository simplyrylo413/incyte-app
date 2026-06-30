'use client';
import { motion } from 'framer-motion';
import React, { useState, useRef, useCallback } from 'react';

interface KnobProps {
  options: string[];
  value: number;
  onChange: (index: number) => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  glow?: boolean;
}

const SIZE_MAP = { small: 40, medium: 56, large: 72 };

export function Knob({ options, value, onChange, size = 'medium', disabled = false, glow = false }: KnobProps) {
  const px = SIZE_MAP[size];
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startIdx = useRef(0);

  const rotation = (value / (options.length - 1)) * 270 - 135;

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    setDragging(true);
    startY.current = e.clientY;
    startIdx.current = value;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [disabled, value]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = startY.current - e.clientY;
    const steps = Math.round(delta / 20);
    const newIdx = Math.max(0, Math.min(options.length - 1, startIdx.current + steps));
    onChange(newIdx);
  }, [dragging, options.length, onChange]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <motion.div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        animate={{ rotate: rotation }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #5a6065 0%, #2a2d32 50%, #0a0a0c 100%)',
          border: '1px solid #0a0a0b',
          boxShadow: glow
            ? `inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.8), 0 0 0 2px rgba(246,232,74,0.2)`
            : `inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.7), 0 4px 12px rgba(0,0,0,0.8)`,
          cursor: disabled ? 'default' : 'ns-resize',
          position: 'relative',
          touchAction: 'none',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        {/* Indicator mark */}
        <div style={{
          position: 'absolute',
          top: 6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 2,
          height: px * 0.14,
          background: 'rgba(255,255,255,0.8)',
          borderRadius: 1,
        }} />
      </motion.div>
      {/* Label */}
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--font-size-small)',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--color-accent)',
      }}>
        {options[value]}
      </span>
    </div>
  );
}
