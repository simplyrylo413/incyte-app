'use client';
import { useState, useCallback } from 'react';
import type { AIRecommendation, WorkoutSet } from '../db/schema';

interface FetchParams {
  movementId: string;
  movementName: string;
  lastWeight: number;
  lastReps: number;
  lastRPE: number;
  history: WorkoutSet[];
}

export function useAIRecommendation() {
  const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params: FetchParams) => {
    setLoading(true);
    setError(null);
    try {
      const res = await globalThis.fetch('/api/ai/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      setRecommendation(data);
    } catch (e) {
      setError('Failed to fetch recommendation');
    } finally {
      setLoading(false);
    }
  }, []);

  const dismiss = useCallback(() => setRecommendation(null), []);

  return { recommendation, loading, error, fetch, dismiss };
}
