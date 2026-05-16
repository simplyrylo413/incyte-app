// import-exercises — Supabase Edge Function
// Fetches exercises from ExerciseDB API (via RapidAPI) for a given list of
// body parts and returns them formatted for the INCYTE movements table.
//
// POST body: { bodyParts?: string[] }  — defaults to all major groups
// Response:  { exercises: ExerciseRow[] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPIDAPI_KEY = Deno.env.get("EXERCISEDB_API_KEY") ?? "";
const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const BASE_URL = `https://${RAPIDAPI_HOST}`;

const ALL_BODY_PARTS = [
  "chest", "back", "shoulders", "upper arms", "lower arms",
  "upper legs", "lower legs", "waist", "cardio", "neck",
];

// Map ExerciseDB body parts → INCYTE muscle labels
const MUSCLE_MAP: Record<string, string> = {
  "chest": "chest",
  "back": "back",
  "shoulders": "shoulders",
  "upper arms": "biceps",     // split further below by target
  "lower arms": "biceps",
  "upper legs": "quads",
  "lower legs": "calves",
  "waist": "core",
  "cardio": "cardio",
  "neck": "other",
};

const TARGET_MUSCLE_MAP: Record<string, string> = {
  "biceps": "biceps",
  "triceps": "triceps",
  "quads": "quads",
  "hamstrings": "hamstrings",
  "glutes": "glutes",
  "calves": "calves",
  "lats": "back",
  "traps": "back",
  "delts": "shoulders",
  "abs": "core",
};

interface ExerciseDBItem {
  id: string;
  name: string;
  bodyPart: string;
  equipment: string;
  target: string;
  secondaryMuscles: string[];
  instructions: string[];
  gifUrl?: string;
}

interface ExerciseRow {
  id: string;
  name: string;
  muscle: string;
  category: string;
  kind: string;
  equipment: string;
  notes: string;
}

function toMuscle(item: ExerciseDBItem): string {
  // Use target muscle for more precision when body part is generic
  const byTarget = TARGET_MUSCLE_MAP[item.target];
  if (byTarget) return byTarget;
  return MUSCLE_MAP[item.bodyPart] ?? "other";
}

function toEquipment(eq: string): string {
  const map: Record<string, string> = {
    "barbell": "barbell",
    "dumbbell": "dumbbell",
    "cable": "cable",
    "machine": "machine",
    "body weight": "bodyweight",
    "ez barbell": "barbell",
    "kettlebell": "dumbbell",
    "resistance band": "cable",
    "band": "cable",
  };
  return map[eq.toLowerCase()] ?? eq;
}

async function fetchByBodyPart(bodyPart: string): Promise<ExerciseDBItem[]> {
  const encoded = encodeURIComponent(bodyPart);
  const url = `${BASE_URL}/exercises/bodyPart/${encoded}?limit=100&offset=0`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });
  if (!res.ok) {
    console.warn(`ExerciseDB ${bodyPart} failed: ${res.status}`);
    return [];
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!RAPIDAPI_KEY) {
      return new Response(
        JSON.stringify({ error: "EXERCISEDB_API_KEY secret not set" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parts: string[] = body.bodyParts ?? ALL_BODY_PARTS;

    // Fetch all body parts in parallel (RapidAPI free tier: 1k req/day)
    const results = await Promise.all(parts.map(fetchByBodyPart));
    const raw: ExerciseDBItem[] = results.flat();

    // Deduplicate by lowercased name
    const seen = new Set<string>();
    const exercises: ExerciseRow[] = [];
    for (const item of raw) {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      const muscle = toMuscle(item);
      exercises.push({
        id: `mv_edb_${item.id}`,
        name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
        muscle,
        category: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        kind: item.bodyPart === "cardio" ? "cardio" : "strength",
        equipment: toEquipment(item.equipment),
        notes: item.instructions?.slice(0, 2).join(" ") ?? "",
      });
    }

    return new Response(
      JSON.stringify({ exercises, count: exercises.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
