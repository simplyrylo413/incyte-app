'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Display } from '../primitives/Display';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function PlanScreen() {
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // 0=Sun adjust to Mon-based
  });

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
        WEEKLY PROGRAM
      </div>
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 24,
        fontWeight: 800,
        color: 'var(--color-text-primary)',
        marginBottom: 'var(--space-lg)',
        letterSpacing: '-0.01em',
      }}>
        Training Plan
      </div>

      {/* Week calendar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 4,
        marginBottom: 'var(--space-lg)',
      }}>
        {DAYS.map((day, i) => {
          const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
          const isSelected = i === selectedDay;
          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDay(i)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 4px',
                background: isSelected ? 'var(--color-accent)' : isToday ? 'var(--color-surface-3)' : 'var(--color-surface-1)',
                border: `1px solid ${isSelected ? 'var(--color-accent)' : isToday ? 'rgba(246,232,74,0.3)' : 'var(--color-rule)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: isSelected ? '#0a0a0a' : 'var(--color-text-label)',
                textTransform: 'uppercase',
              }}>
                {day}
              </span>
              {isToday && !isSelected && (
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--color-accent)', marginTop: 3 }} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Selected day plan */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-rule)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-md)',
      }}>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-label)',
          fontWeight: 700,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--color-text-label)',
          marginBottom: 'var(--space-sm)',
        }}>
          {DAYS[selectedDay]} PROGRAM
        </div>
        <div style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>
          No movements planned. Plan feature coming soon.
        </div>
      </div>
    </div>
  );
}
