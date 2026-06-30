'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Movement, WorkoutSet } from '../db/schema';

interface WorkoutState {
  currentWorkoutId: string | null;
  currentMovement: Movement | null;
  sets: WorkoutSet[];
  weight: number;
  reps: number;
  rpe: number;
  aiAssistEnabled: boolean;
  restTimerActive: boolean;
  restTimeRemaining: number;
  restDuration: number;

  setCurrentMovement: (m: Movement) => void;
  setWeight: (w: number) => void;
  setReps: (r: number) => void;
  setRPE: (rpe: number) => void;
  addSetLocally: (s: WorkoutSet) => void;
  removeSet: (id: string) => void;
  startWorkout: (id: string) => void;
  finishWorkout: () => void;
  toggleAIAssist: () => void;
  startRestTimer: (duration: number) => void;
  tickRestTimer: () => void;
  stopRestTimer: () => void;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set) => ({
      currentWorkoutId: null,
      currentMovement: null,
      sets: [],
      weight: 135,
      reps: 10,
      rpe: 7,
      aiAssistEnabled: false,
      restTimerActive: false,
      restTimeRemaining: 0,
      restDuration: 90,

      setCurrentMovement: (m) => set({ currentMovement: m }),
      setWeight: (w) => set({ weight: w }),
      setReps: (r) => set({ reps: r }),
      setRPE: (rpe) => set({ rpe }),
      addSetLocally: (s) => set((state) => ({ sets: [...state.sets, s] })),
      removeSet: (id) => set((state) => ({ sets: state.sets.filter((s) => s.id !== id) })),
      startWorkout: (id) => set({ currentWorkoutId: id, sets: [] }),
      finishWorkout: () => set({ currentWorkoutId: null, currentMovement: null, sets: [] }),
      toggleAIAssist: () => set((state) => ({ aiAssistEnabled: !state.aiAssistEnabled })),
      startRestTimer: (duration) => set({ restTimerActive: true, restTimeRemaining: duration, restDuration: duration }),
      tickRestTimer: () =>
        set((state) => {
          const next = state.restTimeRemaining - 1;
          if (next <= 0) return { restTimerActive: false, restTimeRemaining: 0 };
          return { restTimeRemaining: next };
        }),
      stopRestTimer: () => set({ restTimerActive: false, restTimeRemaining: 0 }),
    }),
    { name: 'incyte:workout' }
  )
);
