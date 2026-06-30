'use client';
import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Cassette } from '../console/Cassette';
import { RecommendationSheet } from '../console/RecommendationSheet';
import { getSupabaseClient } from '@/lib/db/client';
import { useWorkoutStore } from '@/lib/state/workoutStore';
import { useTimerStore } from '@/lib/state/timerStore';
import { useAIRecommendation } from '@/lib/hooks/useAIRecommendation';
import type { WorkoutSet } from '@/lib/db/schema';

export function WorkoutConsole() {
  const router = useRouter();
  const {
    currentMovement, currentWorkoutId, sets,
    weight, reps, rpe,
    setWeight, setReps, setRPE,
    addSetLocally, finishWorkout,
    aiAssistEnabled, toggleAIAssist,
  } = useWorkoutStore();
  const { isActive: restActive, timeRemaining, start: startTimer } = useTimerStore();
  const { recommendation, loading: aiLoading, fetch: fetchAI, dismiss: dismissAI } = useAIRecommendation();
  const [setHistory, setSetHistory] = useState<WorkoutSet[]>([]);

  const handleLogSet = useCallback(async () => {
    if (!currentMovement || !currentWorkoutId) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('sets')
      .insert({
        workout_id: currentWorkoutId,
        movement_id: currentMovement.id,
        weight_lbs: weight,
        reps,
        rpe,
      })
      .select('*, movement:movements(*)')
      .single();

    if (data) {
      addSetLocally(data);
      const newHistory = [...setHistory, data];
      setSetHistory(newHistory);

      // Start rest timer
      startTimer(90);

      // AI recommendation if enabled
      if (aiAssistEnabled) {
        await fetchAI({
          movementId: currentMovement.id,
          movementName: currentMovement.name,
          lastWeight: weight,
          lastReps: reps,
          lastRPE: rpe,
          history: newHistory.slice(-5),
        });
      }
    }
  }, [currentMovement, currentWorkoutId, weight, reps, rpe, setHistory, aiAssistEnabled]);

  const handleApplyRecommendation = useCallback(() => {
    if (!recommendation) return;
    setWeight(recommendation.weight);
    setReps(recommendation.reps);
    dismissAI();
  }, [recommendation, setWeight, setReps, dismissAI]);

  const handleFinish = useCallback(async () => {
    if (currentWorkoutId) {
      const supabase = getSupabaseClient();
      await supabase
        .from('workouts')
        .update({ completed: true, duration_minutes: Math.ceil((Date.now() - Date.now()) / 60000) })
        .eq('id', currentWorkoutId);
    }
    finishWorkout();
    router.push('/today');
  }, [currentWorkoutId, finishWorkout, router]);

  if (!currentMovement) {
    return (
      <div style={{ padding: 'var(--space-md)', textAlign: 'center' }}>
        <div style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          No movement selected. Go back to Today.
        </div>
      </div>
    );
  }

  const movementSets = sets.filter((s) => s.movement_id === currentMovement.id);

  return (
    <div style={{ padding: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
      {/* Back button */}
      <button
        onClick={() => router.push('/today')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 'var(--space-md)',
          background: 'none',
          border: 'none',
          color: 'var(--color-accent)',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        ← BACK
      </button>

      {/* Main Cassette console */}
      <Cassette
        movement={currentMovement}
        weight={weight}
        reps={reps}
        rpe={rpe}
        onWeightChange={setWeight}
        onRepsChange={setReps}
        onRPEChange={setRPE}
        onLogSet={handleLogSet}
        aiAssistActive={aiAssistEnabled}
        onAIToggle={toggleAIAssist}
        restTimerActive={restActive}
        restTimeRemaining={timeRemaining}
        onFinish={handleFinish}
      />

      {/* AI Recommendation */}
      {(recommendation || aiLoading) && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <RecommendationSheet
            recommendation={recommendation}
            onApply={handleApplyRecommendation}
            onDismiss={dismissAI}
            isLoading={aiLoading}
          />
        </div>
      )}

      {/* Set history */}
      {movementSets.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div style={{
            fontSize: 'var(--font-size-label)',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--color-text-label)',
            marginBottom: 8,
          }}>
            SET HISTORY
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {movementSets.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-dim)' }}>
                  #{i + 1}
                </span>
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: 16, color: 'var(--color-accent)' }}>
                  {s.weight_lbs}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-label)', textTransform: 'uppercase' }}>lbs</span>
                <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>×</span>
                <span style={{ fontFamily: 'var(--font-retro)', fontSize: 16, color: 'var(--color-accent)' }}>
                  {s.reps}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-label)', textTransform: 'uppercase' }}>reps</span>
                <span style={{ color: 'var(--color-text-dim)', fontSize: 12 }}>@</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-success)' }}>
                  {s.rpe}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
