'use client';
import { motion, useDragControls } from 'framer-motion';
import React, { useRef, useCallback } from 'react';

interface FaderProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
  height?: number;
  showGlow?: boolean;
}

export function Fader({ value, onChange, min = 0, max = 100, label, height = 120, showGlow = true }: FaderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = (value - min) / (max - min);
  const thumbY = (1 - pct) * (height - 20);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relY = e.clientY - rect.top;
    const newPct = 1 - Math.max(0, Math.min(1, relY / height));
    onChange(Math.round(min + newPct * (max - min)));
  }, [height, min, max, onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {label && (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-label)',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-label)',
        }}>
          {label}
        </span>
      )}
      <div
        ref={trackRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerMove}
        style={{
          width: 12,
          height,
          background: 'linear-gradient(180deg, #2a2e33 0%, #1a1d20 50%, #0e1012 100%)',
          border: '1px solid #1a1d20',
          borderRadius: 3,
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.8)',
          position: 'relative',
          cursor: 'ns-resize',
          touchAction: 'none',
        }}
      >
        {/* Glow below thumb */}
        {showGlow && (
          <div style={{
            position: 'absolute',
            top: thumbY + 16,
            left: 0,
            width: '100%',
            height: 24,
            background: 'linear-gradient(180deg, #f6e84a 0%, transparent 100%)',
            opacity: 0.4,
            filter: 'blur(2px)',
            pointerEvents: 'none',
          }} />
        )}
        {/* Thumb */}
        <div style={{
          position: 'absolute',
          top: thumbY,
          left: -8,
          width: 28,
          height: 16,
          background: 'linear-gradient(180deg, #5a6065 0%, #2a2d32 100%)',
          borderRadius: 3,
          border: '1px solid #0a0a0b',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.6)',
          cursor: 'grab',
        }} />
      </div>
    </div>
  );
}
