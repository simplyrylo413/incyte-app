'use client';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import { Button } from '../primitives/Button';
import type { AIRecommendation } from '@/lib/db/schema';

interface RecommendationSheetProps {
  recommendation: AIRecommendation | null;
  onApply: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function RecommendationSheet({ recommendation, onApply, onDismiss, isLoading = false }: RecommendationSheetProps) {
  return (
    <AnimatePresence>
      {(recommendation || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background: 'linear-gradient(145deg, rgba(227,84,84,0.15) 0%, rgba(50,10,10,0.9) 100%)',
            border: '1px solid rgba(227,84,84,0.3)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-md)',
          }}
        >
          <div style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--font-size-label)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-danger)',
            marginBottom: 8,
          }}>
            AI RECOMMENDATION
          </div>

          {isLoading ? (
            <div style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
              Analyzing...
            </div>
          ) : recommendation && (
            <>
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-retro)', fontSize: 28, color: '#f6e84a', filter: 'drop-shadow(0 0 4px rgba(246,232,74,0.6))' }}>
                    {recommendation.weight}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--color-text-label)', textTransform: 'uppercase' }}>LBS</div>
                </div>
                <div style={{ color: 'var(--color-text-dim)', alignSelf: 'center', fontSize: 12 }}>×</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-retro)', fontSize: 28, color: '#f6e84a', filter: 'drop-shadow(0 0 4px rgba(246,232,74,0.6))' }}>
                    {recommendation.reps}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--color-text-label)', textTransform: 'uppercase' }}>REPS</div>
                </div>
              </div>
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--color-text-dim)',
                margin: '0 0 12px',
                lineHeight: 1.5,
              }}>
                {recommendation.reasoning}
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="small" onClick={onDismiss}>✕ DISMISS</Button>
                <Button variant="primary" size="small" glow onClick={onApply}>→ APPLY</Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
