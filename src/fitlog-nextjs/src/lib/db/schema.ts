export type User = {
  id: string;
  email: string;
  name: string;
  theme: 'dark' | 'light';
  created_at: string;
};

export type Movement = {
  id: string;
  name: string;
  body_part: string;
  equipment: string[];
  description?: string;
};

export type Workout = {
  id: string;
  user_id: string;
  date: string;
  duration_minutes?: number;
  completed: boolean;
  created_at: string;
};

export type WorkoutSet = {
  id: string;
  workout_id: string;
  movement_id: string;
  weight_lbs: number;
  reps: number;
  rpe: number;
  notes?: string;
  created_at: string;
  movement?: Movement;
};

export type PersonalRecord = {
  id: string;
  user_id: string;
  movement_id: string;
  max_weight: number;
  max_reps: number;
  last_updated: string;
  movement?: Movement;
};

export type AIRecommendation = {
  weight: number;
  reps: number;
  reasoning: string;
};
