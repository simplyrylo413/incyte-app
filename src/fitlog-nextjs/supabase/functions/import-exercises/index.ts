// import-exercises — Supabase Edge Function
// Fetches exercises from ExerciseDB and inserts them into the movements table
// using the service-role key (bypasses RLS).
//
// POST body: { userId: string, bodyParts?: string[] }
//   userId  — the caller's auth.uid(); used as movements.user_id
//   bodyParts — optional subset of ALL_BODY_PARTS to fetch

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

// Maps ExerciseDB bodyPart → our body_part label
const BODY_PART_MAP: Record<string, string> = {
  "chest": "chest",
  "back": "back",
  "shoulders": "shoulders",
  "upper arms": "biceps",
  "lower arms": "biceps",
  "upper legs": "quads",
  "lower legs": "calves",
  "waist": "core",
  "cardio": "cardio",
  "neck": "other",
};

// Maps ExerciseDB target muscle → our body_part label (more specific)
const TARGET_MAP: Record<string, string> = {
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

function toBodyPart(item: { target: string; bodyPart: string }): string {
  return TARGET_MAP[item.target] ?? BODY_PART_MAP[item.bodyPart] ?? "other";
}

async function fetchByBodyPart(bodyPart: string): Promise<any[]> {
  const url = `https://${RAPIDAPI_HOST}/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=100&offset=0`;
  const res = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": RAPIDAPI_HOST,
    },
  });
  if (!res.ok) {
    console.warn(`ExerciseDB ${bodyPart}: HTTP ${res.status}`);
    return [];
  }
  return res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const userId: string = body.userId ?? "";
    const parts: string[] = body.bodyParts ?? ALL_BODY_PARTS;

    if (!RAPIDAPI_KEY) throw new Error("EXERCISEDB_API_KEY secret not set");
    if (!userId) throw new Error("userId is required");

    // Fetch in batches of 3 with 300 ms between batches to stay under rate limit
    const raw: any[] = [];
    for (let i = 0; i < parts.length; i += 3) {
      const batch = parts.slice(i, i + 3);
      const results = await Promise.all(batch.map(fetchByBodyPart));
      results.forEach((items) => raw.push(...items));
      if (i + 3 < parts.length) await new Promise((r) => setTimeout(r, 300));
    }

    // Deduplicate by lowercase name
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const item of raw) {
      const key = item.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);

      const bodyPart = toBodyPart(item);
      const kind = item.bodyPart === "cardio" ? "cardio" : "weight";
      const notes = Array.isArray(item.instructions)
        ? item.instructions.slice(0, 2).join(" ").slice(0, 500)
        : null;

      rows.push({
        id: crypto.randomUUID(),
        user_id: userId,
        name: item.name.charAt(0).toUpperCase() + item.name.slice(1),
        kind,
        body_part: bodyPart,
        equipment_type: item.equipment ?? null,
        notes: notes || null,
      });
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ inserted: 0, total: 0, message: "No exercises fetched from ExerciseDB" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Upsert in chunks of 100; conflict on (user_id, name) → skip duplicates
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error, count } = await supabase
        .from("movements")
        .upsert(chunk, { onConflict: "user_id,name", ignoreDuplicates: true })
        .select("id", { count: "exact", head: true });
      if (error) {
        console.error("Chunk insert error:", JSON.stringify(error));
      } else {
        inserted += count ?? chunk.length;
      }
    }

    return new Response(
      JSON.stringify({ inserted, total: rows.length }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("import-exercises error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
