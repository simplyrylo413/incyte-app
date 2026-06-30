-- INCYTE v2.0 Schema
-- Run this against your Supabase project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Movements (exercise library)
CREATE TABLE IF NOT EXISTS movements (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  body_part   TEXT NOT NULL DEFAULT 'General',
  equipment   TEXT[] DEFAULT '{}',
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Workouts (sessions)
CREATE TABLE IF NOT EXISTS workouts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL,
  date             DATE NOT NULL DEFAULT CURRENT_DATE,
  duration_minutes INT,
  completed        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Sets (logged reps)
CREATE TABLE IF NOT EXISTS sets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_id  UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES movements(id),
  weight_lbs  FLOAT NOT NULL DEFAULT 0,
  reps        INT NOT NULL DEFAULT 0,
  rpe         INT CHECK (rpe BETWEEN 1 AND 10),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Personal Records
CREATE TABLE IF NOT EXISTS personal_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL,
  movement_id  UUID NOT NULL REFERENCES movements(id),
  max_weight   FLOAT NOT NULL DEFAULT 0,
  max_reps     INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, movement_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sets_workout ON sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_movement ON sets(movement_id);
CREATE INDEX IF NOT EXISTS idx_prs_user ON personal_records(user_id);

-- Seed movement library
INSERT INTO movements (name, body_part, equipment) VALUES
  ('Barbell Back Squat', 'Legs', ARRAY['Barbell', 'Rack']),
  ('Barbell Bench Press', 'Chest', ARRAY['Barbell', 'Bench']),
  ('Conventional Deadlift', 'Back', ARRAY['Barbell']),
  ('Overhead Press', 'Shoulders', ARRAY['Barbell']),
  ('Barbell Row', 'Back', ARRAY['Barbell']),
  ('Pull-Up', 'Back', ARRAY['Pull-up Bar']),
  ('Dip', 'Chest', ARRAY['Dip Bar']),
  ('Romanian Deadlift', 'Legs', ARRAY['Barbell']),
  ('Front Squat', 'Legs', ARRAY['Barbell', 'Rack']),
  ('Incline Bench Press', 'Chest', ARRAY['Barbell', 'Bench']),
  ('Dumbbell Row', 'Back', ARRAY['Dumbbell', 'Bench']),
  ('Lateral Raise', 'Shoulders', ARRAY['Dumbbell']),
  ('Bicep Curl', 'Arms', ARRAY['Barbell']),
  ('Tricep Pushdown', 'Arms', ARRAY['Cable']),
  ('Leg Press', 'Legs', ARRAY['Machine']),
  ('Leg Curl', 'Legs', ARRAY['Machine']),
  ('Cable Row', 'Back', ARRAY['Cable']),
  ('Face Pull', 'Shoulders', ARRAY['Cable']),
  ('Calf Raise', 'Legs', ARRAY['Machine']),
  ('Hip Thrust', 'Legs', ARRAY['Barbell', 'Bench'])
ON CONFLICT DO NOTHING;
