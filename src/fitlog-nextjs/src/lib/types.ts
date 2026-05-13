// Shared types and a minimal Supabase Database typing for the workout tracker.

export type MovementKind = "weight" | "cardio";
export type CardioUnit = "mi" | "m" | "km";
export type TrainingType =
  | "strength"
  | "hypertrophy"
  | "power"
  | "mobility"
  | "endurance";

export const TRAINING_TYPES: TrainingType[] = [
  "strength",
  "hypertrophy",
  "power",
  "mobility",
  "endurance",
];

export type WeightSet = {
  weight: number | null;
  reps: number | null;
  done: boolean;
};

export type CardioSet = {
  distance: number | null;
  time: number | null; // minutes
  done: boolean;
};

export type SetEntry = WeightSet | CardioSet;

export type Movement = {
  id: string;
  user_id: string;
  name: string;
  kind: MovementKind;
  unit: CardioUnit | null; // only when kind === 'cardio'
  notes: string | null;
  created_at: string;
};

export type Workout = {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  finished: boolean;
  notes: string | null;
  created_at: string;
};

export type WorkoutEntry = {
  id: string;
  workout_id: string;
  movement_id: string;
  position: number;
  training_type: TrainingType | null; // null for cardio
  sets: SetEntry[]; // jsonb
  planned_reps: string | null;
  created_at: string;
};

// Minimal generated-style typing for supabase-js.
// Keep this in sync with supabase/schema.sql. For full type generation:
//   npx supabase gen types typescript --project-id <ref>
export type Database = {
  public: {
    Tables: {
      movements: {
        Row: Movement;
        Insert: Omit<Movement, "id" | "created_at" | "user_id"> & {
          id?: string;
          user_id?: string;
        };
        Update: Partial<Omit<Movement, "id" | "user_id">>;
      };
      workouts: {
        Row: Workout;
        Insert: Omit<Workout, "id" | "created_at" | "user_id"> & {
          id?: string;
          user_id?: string;
        };
        Update: Partial<Omit<Workout, "id" | "user_id">>;
      };
      workout_entries: {
        Row: WorkoutEntry;
        Insert: Omit<WorkoutEntry, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<WorkoutEntry, "id">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
