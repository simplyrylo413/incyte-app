'use client';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Knob } from '../primitives/Knob';
import { Display } from '../primitives/Display';

const INSIGHT_MODES = ['READINESS', 'BALANCE', 'RECOVERY', 'PROGRESSION', 'RECORDS'];

interface Stats {
  readiness: number;
  totalVolumeLbs: number;
  recentWorkoutCount: number;
  personalRecords: Array<{ movement: { name: string }; max_weight: number; max_reps: number }>;
}

export function InsightsScreen() {
  const [mode, setMode] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const readiness = stats?.readiness ?? 0;
  const readinessColor: 'green' | 'yellow' | 'red' =
    readiness >= 70 ? 'green' : readiness >= 40 ? 'yellow' : 'red';

  return (
    <div style={{ padding: 'var(--space-md)', paddingTop: 'var(--space-lg)' }}>
      {/* Header */}
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--color-text-label)',
        marginBottom: 6,
      }}>
        PERFORMANCE INTEL
      </div>

      {/* Primary display — readiness score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-lg)',
          marginBottom: 'var(--space-md)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Chassis glow */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 1,
          background: 'var(--color-edge-light)',
        }} />
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-label)',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--color-text-label)',
          marginBottom: 'var(--space-sm)',
        }}>
          {INSIGHT_MODES[mode]}
        </div>
        <Display
          value={loading ? '—' : mode === 0 ? `${readiness}%` : mode === 2 ? `${Math.max(0, 7 - (stats?.recentWorkoutCount || 0))} days` : stats?.totalVolumeLbs?.toLocaleString() || '0'}
          label={mode === 0 ? 'READINESS' : mode === 2 ? 'SINCE LAST' : 'TOTAL VOLUME'}
          glow={readinessColor}
          size="large"
        />
      </motion.div>

      {/* Knob mode selector */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-rule)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-md)',
        marginBottom: 'var(--space-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-lg)',
      }}>
        <Knob
          options={INSIGHT_MODES}
          value={mode}
          onChange={setMode}
          size="medium"
          glow={true}
        />
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          color: 'var(--color-text-dim)',
          lineHeight: 1.4,
        }}>
          Drag to cycle through<br />insight modes
        </div>
      </div>

      {/* Personal Records (RECORDS mode) */}
      {mode === 4 && (
        <div>
          <div style={{
            fontSize: 'var(--font-size-label)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-text-label)',
            marginBottom: 8,
          }}>
            PERSONAL RECORDS
          </div>
          {(stats?.personalRecords || []).length === 0 ? (
            <div style={{ color: 'var(--color-text-dim)', fontSize: 13, padding: 16, textAlign: 'center' }}>
              No records yet. Start logging.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(stats?.personalRecords || []).map((pr, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-lg)',
                }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {pr.movement?.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-retro)', fontSize: 18, color: 'var(--color-accent)' }}>
                    {pr.max_weight} lbs
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Weekly volume chart (PROGRESSION mode) */}
      {mode === 3 && stats && (
        <div style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-md)',
        }}>
          <div style={{ color: 'var(--color-text-dim)', fontSize: 13, textAlign: 'center', padding: 16 }}>
            {stats.recentWorkoutCount} sessions this week
          </div>
        </div>
      )}
    </div>
  );
}
