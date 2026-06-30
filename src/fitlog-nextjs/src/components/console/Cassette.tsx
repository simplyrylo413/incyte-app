'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Display } from '../primitives/Display';
import { Button } from '../primitives/Button';
import { LED } from '../primitives/LED';
import { Reel } from '../primitives/Reel';
import { Fader } from '../primitives/Fader';
import { RestTimer } from './RestTimer';
import type { Movement } from '@/lib/db/schema';

interface CassetteProps {
  movement: Movement;
  weight: number;
  reps: number;
  rpe: number;
  onWeightChange: (w: number) => void;
  onRepsChange: (r: number) => void;
  onRPEChange: (rpe: number) => void;
  onLogSet: () => void;
  aiAssistActive: boolean;
  onAIToggle: () => void;
  restTimerActive: boolean;
  restTimeRemaining: number;
  onFinish: () => void;
}

export function Cassette({
  movement, weight, reps, rpe,
  onWeightChange, onRepsChange, onRPEChange,
  onLogSet, aiAssistActive, onAIToggle,
  restTimerActive, restTimeRemaining, onFinish,
}: CassetteProps) {
  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(0,0,0,0.8)',
    }}>
      {/* Top bar — movement name */}
      <div style={{
        background: 'var(--color-surface-deep)',
        borderBottom: '1px solid var(--color-rule)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--font-size-label)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-text-label)',
            marginBottom: 2,
          }}>
            {movement.body_part}
          </div>
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.02em',
          }}>
            {movement.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LED color={aiAssistActive ? 'yellow' : 'off'} size="small" pulse={aiAssistActive} />
          <Button size="small" variant={aiAssistActive ? 'primary' : 'secondary'} onClick={onAIToggle}
            style={{ fontSize: 8, letterSpacing: '0.12em' }}>
            AI
          </Button>
        </div>
      </div>

      {/* Cassette window — reel area */}
      <div style={{
        background: 'linear-gradient(180deg, #0c0c0e 0%, #080808 100%)',
        borderBottom: '1px solid var(--color-rule)',
        padding: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 24,
        position: 'relative',
      }}>
        {/* Glossy window effect */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%)',
          pointerEvents: 'none',
        }} />
        <Reel spinning={restTimerActive} position="left" size={52} />

        {/* Center: rest timer or status */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 0 }}>
          {restTimerActive ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--color-text-label)', textTransform: 'uppercase', marginBottom: 4 }}>REST</div>
              <div style={{
                fontFamily: 'var(--font-retro)',
                fontSize: 32,
                color: '#f6e84a',
                filter: 'drop-shadow(0 0 8px rgba(245,232,0,0.7))',
                lineHeight: 1,
              }}>
                {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--font-size-nano)',
                letterSpacing: '0.2em',
                color: 'var(--color-text-dim)',
                textTransform: 'uppercase',
              }}>
                INCYTE · MDL-X7
              </div>
            </div>
          )}
        </div>

        <Reel spinning={restTimerActive} position="right" size={52} />
      </div>

      {/* LCD Displays — weight × reps × RPE */}
      <div style={{
        padding: '12px 16px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr auto 1fr',
        gap: 8,
        alignItems: 'center',
        borderBottom: '1px solid var(--color-rule)',
      }}>
        <Display value={weight} unit="lbs" label="WEIGHT" glow="yellow" size="medium" />
        <div style={{ color: 'var(--color-text-dim)', fontSize: 20, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>×</div>
        <Display value={reps} label="REPS" glow="yellow" size="medium" />
        <div style={{ color: 'var(--color-text-dim)', fontSize: 20, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>@</div>
        <Display value={rpe} label="RPE" glow="green" size="medium" />
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-rule)' }}>
        {/* Weight control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--color-text-label)', textTransform: 'uppercase' }}>WEIGHT</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[-10, -5, -2.5].map((d) => (
              <Button key={d} size="small" onClick={() => onWeightChange(Math.max(0, weight + d))}
                style={{ fontSize: 9, minWidth: 36 }}>
                {d}
              </Button>
            ))}
            {[2.5, 5, 10].map((d) => (
              <Button key={d} size="small" onClick={() => onWeightChange(weight + d)}
                style={{ fontSize: 9, minWidth: 36 }}>
                +{d}
              </Button>
            ))}
          </div>
        </div>
        {/* Reps control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--color-text-label)', textTransform: 'uppercase' }}>REPS</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[-3, -1].map((d) => (
              <Button key={d} size="small" onClick={() => onRepsChange(Math.max(1, reps + d))}
                style={{ fontSize: 9, minWidth: 36 }}>
                {d}
              </Button>
            ))}
            {[1, 3].map((d) => (
              <Button key={d} size="small" onClick={() => onRepsChange(reps + d)}
                style={{ fontSize: 9, minWidth: 36 }}>
                +{d}
              </Button>
            ))}
          </div>
        </div>
        {/* RPE control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--color-text-label)', textTransform: 'uppercase' }}>RPE</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map((v) => (
              <button
                key={v}
                onClick={() => onRPEChange(v)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: rpe === v ? '#f6e84a' : 'var(--color-surface-3)',
                  color: rpe === v ? '#0a0a0a' : 'var(--color-text-dim)',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
        <Button variant="primary" size="large" glow onClick={onLogSet} fullWidth>
          LOG SET
        </Button>
        <Button variant="danger" size="large" onClick={onFinish} style={{ minWidth: 100 }}>
          FINISH
        </Button>
      </div>
    </div>
  );
}
