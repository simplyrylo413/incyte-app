// Types aligned with the HTML build's actual Supabase contract — NOT the
// scaffold's stale schema.sql. Source of truth: src/fitlog-mobile.html
// (movements ~10750–10800 area, workouts ~17040–17050 sync helper).
//
// Key differences from the scaffold's original types:
//   - Workout carries inline `entries` jsonb (no separate workout_entries table)
//   - device_id keying (no auth.uid() yet)
//   - Sets carry equipment + variant identity fields
//   - Mobility movements have `time` instead of weight/reps
//   - Cardio movements have per-type fields (distance, time, incline, speed)

export type MovementKind = "weight" | "cardio" | undefined;
// Movement category — derived, used for grouping/display. "mobility" is
// inferred by name/muscle pattern in isMobility(), not stored explicitly.
export type Category = "strength" | "cardio" | "mobility";

// Strength-style set (also covers mobility's `time`-only sets via optional
// fields). Empty string is treated equivalently to null per the HTML build's
// hasV() predicate.
export type SetEntry = {
  weight?: number | string | null;
  reps?: number | string | null;
  rpe?: number | string | null;
  done: boolean;
  warmup?: boolean;
  bw?: boolean;
  // Cardio + mobility extensions
  time?: number | string | null; // decimal minutes
  distance?: number | string | null;
  incline?: number | string | null;
  speed?: number | string | null;
  bpm?: number | string | null;
  // Prior-session reference values (populated by defaultSetsFor)
  prevW?: number | string | null;
  prevR?: number | string | null;
  prevRpe?: number | string | null;
  prevTime?: number | string | null;
  prevBW?: boolean;
  // Baseline flag — set when sets are seeded from the prior session and
  // hasn't yet been touched by the user. Cleared on first user interaction.
  baseline?: boolean;
};

export type Movement = {
  id: string;
  name: string;
  kind?: MovementKind;
  category?: Category;
  muscle?: string;
  bodyPart?: string;
  unit?: string; // cardio: 'mi' | 'km' | 'm'
  notes?: string | null;
  defaultSets?: number;
  defaultReps?: string | number | null;
  equipmentType?: string;
  variant?: string;
  canonicalMovement?: string;
  gifUrl?: string;
  secondaryMuscles?: string[];
  instructions?: string[];
};

export type WorkoutEntry = {
  movementId: string;
  planId?: string | null;
  sets: SetEntry[];
  plannedReps?: string | number | null;
  skipped?: boolean;
  // Identity fields per the data-governance rebuild — every entry carries
  // (canonicalMovement, equipmentType, variant) so progress/PRs key
  // correctly even across movement renames/migrations.
  canonicalMovement?: string;
  equipmentType?: string;
  variant?: string;
  muscle?: string;
  name?: string;
  archivedAt?: string; // ISO timestamp when this entry was auto-archived
};

export type Workout = {
  id: string;
  device_id?: string; // build-phase keying; replaced by user_id at launch
  name?: string;
  date: string; // ISO timestamp
  finished: boolean;
  entries: WorkoutEntry[];
  // HTML build extras — present on most rows after auto-archive
  savedAt?: string;
  completed_at?: string;
  edited_at?: string;
  workout_status?: "completed" | "saved" | string;
  durationMin?: number;
  autoArchived?: boolean;
  notes?: string | null;
  split?: string;
};

export type PlanItem = {
  id: string;
  mid: string; // movementId
  dow: number; // 0–6, Sun–Sat
  sets?: number;
  reps?: string | number | null;
  rpe?: string | number | null;
  tempo?: string | null;
  notes?: string | null;
  targetWeight?: number | null;
  trainingType?: string | null;
  equipmentType?: string;
  variant?: string;
  muscle?: string;
  order?: number;
};

// Tombstone arrays — track ids the user has deleted so stale Supabase
// realtime fetches don't resurrect them.
export type Tombstones = {
  movements: string[];
  plans: string[];
  workouts: string[];
};

// ----------------------------------------------------------------------------
// Legacy type aliases — kept ONLY so the scaffold's dormant components
// (MovementCard, MovementsManager, ProgressView, etc.) continue to compile
// during Phase 0. None of these are routed in the active app. All ported
// surfaces use the unified SetEntry above. Remove once Phase 7 rebuilds the
// affected components.
// ----------------------------------------------------------------------------
export type CardioUnit = "mi" | "km" | "m";
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
export type WeightSet = SetEntry;
export type CardioSet = SetEntry;

// Minimal Supabase Database typing. Matches what the HTML build actually
// upserts. The columns below are the canonical set; the scaffold's older
// schema.sql has fewer columns and is deprecated.
export type Database = {
  public: {
    Tables: {
      movements: {
        Row: {
          id: string;
          device_id: string | null;
          name: string;
          kind: string | null;
          muscle: string | null;
          body_part: string | null;
          unit: string | null;
          notes: string | null;
          equipment_type: string | null;
          variant: string | null;
          canonical_movement: string | null;
          default_sets: number | null;
          default_reps: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["movements"]["Row"]> & {
          id?: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["movements"]["Row"]>;
      };
      workouts: {
        Row: {
          id: string;
          device_id: string | null;
          name: string | null;
          date: string;
          finished: boolean;
          entries: WorkoutEntry[]; // jsonb
          saved_at: string | null;
          completed_at: string | null;
          edited_at: string | null;
          notes: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["workouts"]["Row"]> & {
          id?: string;
          date: string;
        };
        Update: Partial<Database["public"]["Tables"]["workouts"]["Row"]>;
      };
      plans: {
        Row: {
          id: string;
          device_id: string | null;
          mid: string;
          dow: number;
          sets: number | null;
          reps: string | null;
          rpe: string | null;
          tempo: string | null;
          notes: string | null;
          target_weight: number | null;
          training_type: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["plans"]["Row"]> & {
          id?: string;
          mid: string;
          dow: number;
        };
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
