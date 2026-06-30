'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getSupabaseClient } from '@/lib/db/client';
import type { Movement, Workout, WorkoutSet } from '@/lib/db/schema';
import { useWorkoutStore } from '@/lib/state/workoutStore';

const HEADLINES = [
  "Strength is a habit.",
  "Show up. Load it. Move it.",
  "Calibrate the load.",
  "Progressive. Consistent. Precise.",
  "The bar doesn't lie.",
];

export function TodayScreen() {
  const router = useRouter();
  const { startWorkout, setCurrentMovement, currentWorkoutId } = useWorkoutStore();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [todaySets, setTodaySets] = useState<WorkoutSet[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      // Load movements
      const { data: movs } = await supabase.from('movements').select('*').order('name').limit(20);
      setMovements(movs || []);

      if (user) {
        // Today's workout
        const today = new Date().toISOString().split('T')[0];
        const { data: workout } = await supabase
          .from('workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setActiveWorkout(workout);

        if (workout) {
          const { data: sets } = await supabase
            .from('sets')
            .select('*, movement:movements(*)')
            .eq('workout_id', workout.id)
            .order('created_at');
          setTodaySets(sets || []);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStartMovement = async (movement: Movement) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    let workoutId = currentWorkoutId || activeWorkout?.id;

    if (!workoutId) {
      const today = new Date().toISOString().split('T')[0];
      const { data: workout } = await supabase
        .from('workouts')
        .insert({ user_id: user?.id || 'anonymous', date: today, completed: false })
        .select()
        .single();
      workoutId = workout?.id;
      if (workoutId) startWorkout(workoutId);
    }

    setCurrentMovement(movement);
    router.push(`/workout/${movement.id}`);
  };

  const setsToday = todaySets.length;
  const completedMovements = [...new Set(todaySets.map((s) => s.movement_id))].length;

  return (
    <div style={{ padding: 'var(--space-md)', paddingTop: 'var(--space-lg)' }}>
      {/* Hero headline */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ marginBottom: 'var(--space-lg)' }}
      >
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: 'var(--color-text-label)',
          marginBottom: 6,
        }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <div style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--font-size-headline)',
          fontWeight: 800,
          color: 'var(--color-text-primary)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
        }}>
          {headline.replace('habit.', '')}
          {headline.endsWith('habit.') && (
            <span style={{ color: 'var(--color-accent)' }}>habit.</span>
          )}
        </div>
      </motion.div>

      {/* Stats bar */}
      <div style={{
        display: 'flex',
        borderTop: '1px solid var(--color-rule)',
        borderBottom: '1px solid var(--color-rule)',
        marginBottom: 'var(--space-lg)',
        padding: '10px 0',
      }}>
        {[
          { label: 'SETS TODAY', value: setsToday },
          { label: 'MOVEMENTS', value: completedMovements },
          { label: 'VOLUME', value: todaySets.reduce((acc, s) => acc + s.weight_lbs * s.reps, 0).toLocaleString() + ' lbs' },
        ].map((stat, i) => (
          <div key={i} style={{
            flex: 1,
            textAlign: 'center',
            borderRight: i < 2 ? '1px solid var(--color-rule)' : 'none',
            padding: '0 12px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              lineHeight: 1,
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-text-label)',
              marginTop: 3,
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Movements list */}
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--font-size-label)',
        fontWeight: 700,
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color: 'var(--color-text-label)',
        marginBottom: 10,
      }}>
        MOVEMENT LIBRARY
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: 16 }}>
          Loading...
        </div>
      ) : movements.length === 0 ? (
        <div style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          textAlign: 'center',
        }}>
          <div style={{ color: 'var(--color-text-dim)', fontSize: 14, marginBottom: 8 }}>
            No movements yet.
          </div>
          <div style={{ color: 'var(--color-text-label)', fontSize: 12 }}>
            Add movements to start tracking.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {movements.map((movement) => {
            const setCount = todaySets.filter((s) => s.movement_id === movement.id).length;
            return (
              <motion.button
                key={movement.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleStartMovement(movement)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--color-surface-1)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Body part indicator dot */}
                <div style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {movement.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-label)',
                      background: 'var(--color-surface-3)',
                      padding: '2px 5px',
                      borderRadius: 2,
                    }}>
                      {movement.body_part}
                    </span>
                    {movement.equipment?.[0] && (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--color-text-dim)',
                      }}>
                        {movement.equipment[0]}
                      </span>
                    )}
                  </div>
                </div>

                {setCount > 0 && (
                  <div style={{
                    background: 'var(--color-accent)',
                    color: '#0a0a0a',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 7px',
                    borderRadius: 10,
                    flexShrink: 0,
                  }}>
                    {setCount}
                  </div>
                )}

                {/* Play button */}
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: '1.5px solid var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <svg width="8" height="10" viewBox="0 0 8 10" fill="var(--color-accent)">
                    <path d="M0 0l8 5-8 5V0z"/>
                  </svg>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
