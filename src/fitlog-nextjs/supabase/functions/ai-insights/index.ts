// INCYTE — AI Insights Edge Function
// Proxies OpenAI requests server-side so the API key never touches the client.
// Deployed to: https://drlmpltseepsxostsqdq.supabase.co/functions/v1/ai-insights
//
// Deploy:
//   supabase functions deploy ai-insights --project-ref drlmpltseepsxostsqdq
//   supabase secrets set OPENAI_API_KEY=sk-... --project-ref drlmpltseepsxostsqdq

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1400;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── System prompt ────────────────────────────────────────────────────────────
// Voice: clinical, direct, calibrated — like a sports scientist reviewing data.
// No motivational filler. No generic advice. Every sentence references the data.

const SYSTEM_PROMPT = `You are a training intelligence engine for INCYTE, a progressive overload tracking app for trained lifters.

Analyze the provided workout data and return structured insights. Every claim must be anchored to the numbers in the input — no generic advice, no motivational language.

Voice rules:
- Clinical and direct. Short sentences. Data-driven conclusions.
- Never say: "great job", "crush it", "you got this", "let's go", "amazing", "fantastic"
- Prefer: specific observations, precise recommendations, factual trajectory notes

Return ONLY valid JSON matching this exact schema (no markdown, no extra keys):
{
  "readiness": {
    "summary": "1–2 sentence assessment referencing the actual readiness/recovery/fatigue numbers",
    "recommendation": "3–7 word action phrase (e.g. 'Train heavy — upper body primed')",
    "bullets": ["3 specific bullets based on the data — training focus, target intensity, volume note"]
  },
  "recovery": {
    "<muscle_key_lowercase>": {
      "advice": "1 sentence specific to this muscle's fatigue percentage and days since trained",
      "tone": "low|med|high"
    }
  },
  "stimulus": {
    "summary": "1–2 sentences on weekly volume distribution — name the overrepresented and underrepresented muscles",
    "adjustments": ["2–3 specific volume adjustments for next week"]
  },
  "prs": [
    {
      "movement": "<movement name exactly as provided>",
      "nextTarget": "<specific weight or reps — e.g. '230 lbs' or '6 reps'>",
      "context": "1 sentence on progression trajectory"
    }
  ],
  "weight_recommendations": [
    {
      "movement": "<movement name>",
      "current": <number>,
      "suggested": <number>,
      "unit": "lbs",
      "rationale": "1 sentence referencing RPE history or rep trend"
    }
  ]
}

If there are no PRs, return "prs": [].
If there is insufficient data for weight recommendations, return "weight_recommendations": [].
The recovery object must include a key for every muscle in the input muscle_fatigue arrays.`;

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY secret not configured" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_TOKENS,
        temperature: 0.25, // low temp for consistent, factual output
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error ${openaiRes.status}: ${errText}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const completion = await openaiRes.json();
    const raw = completion?.choices?.[0]?.message?.content;
    if (!raw) {
      return new Response(
        JSON.stringify({ error: "Empty OpenAI response" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const insights = JSON.parse(raw);
    return new Response(JSON.stringify(insights), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
