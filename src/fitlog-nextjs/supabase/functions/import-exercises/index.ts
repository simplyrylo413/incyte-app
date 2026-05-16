// import-exercises — Supabase Edge Function
// Fetches exercises from ExerciseDB, inserts them directly into the
// movements table using the Supabase admin client (bypasses RLS).
// POST body: { deviceId: string, bodyParts?: string[] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RAPIDAPI_KEY = Deno.env.get("EXERCISEDB_API_KEY") ?? "";
const RAPIDAPI_HOST = "exercisedb.p.rapidapi.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALL_BODY_PARTS = [
  "chest", "back", "shoulders", "upper arms", "lower arms",
  "upper legs", "lower legs", "waist", "cardio", "neck",
];

const TARGET_MUSCLE_MAP: Record<string, string> = {
  "biceps": "biceps", "triceps": "triceps", "quads": "quads",
  "hamstrings": "hamstrings", "glutes": "glutes", "calves": "calves",
  "lats": "back", "traps": "back", "delts": "shoulders", "abs": "core",
};
const BODY_PART_MAP: Record<string, string> = {
  "chest": "chest", "back": "back", "shoulders": "shoulders",
  "upper arms": "biceps", "lower arms": "biceps", "upper legs": "quads",
  "lower legs": "calves", "waist": "core", "cardio": "cardio", "neck": "other",
};

function toMuscle(item: any): string {
  return TARGET_MUSCLE_MAP[item.target] ?? BODY_PART_MAP[item.bodyPart] ?? "other";
}

async function fetchByBodyPart(bodyPart: string): Promise<any[]> {
  const res = await fetch(
    `https://${RAPIDAPI_HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=100&offset=0`,
    { headers: { "X-RapidAPI-Key": RAPIDAPI_KEY, "X-RapidAPI-Host": RAPIDAPI_HOST } }
  );
  if (!res.ok) { console.warn(`ExerciseDB ${bodyPart}: ${res.status}`); return []; }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const deviceId: string = body.deviceId ?? "";
    const parts: string[] = body.bodyParts ?? ALL_BODY_PARTS;

    if (!RAPIDAPI_KEY) throw new Error("EXERCISEDB_API_KEY not set");
    if (!deviceId) throw new Error("deviceId required");

    // Fetch exercises sequentially to avoid rate limiting
    const raw: any[] = [];
    for (const part of parts) {
      const items = await fetchByBodyPart(part);
      raw.push(...items);
      await new Promise((r) => setTimeout(r, 600));
    }

    // Deduplicate by name
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const item of raw) {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const muscle = toMuscle(item);
      rows.push({
        id: `mv_edb_${item.id}`,
        device_id: deviceId,
        name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
        category: muscle.charAt(0).toUpperCase() + muscle.slice(1),
        muscle,
        kind: item.bodyPart === "cardio" ? "cardio" : "strength",
        unit: "",
        notes: (item.instructions ?? []).slice(0, 2).join(" "),
        tags: [],
      });
    }

    // Insert directly using service role key (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase.from("movements").upsert(chunk, { onConflict: "id" });
      if (error) console.error("Insert error:", JSON.stringify(error));
      else inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ inserted, total: rows.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
