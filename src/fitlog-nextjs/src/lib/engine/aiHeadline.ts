// Daily AI headline — fetches once per calendar day, caches in localStorage.
// Falls back to the static pool (todayHeadline()) on failure or while loading.

const CACHE_PREFIX = "fitlog_headline_";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// In-flight dedup — prevents double-fetch from React 18 strict-mode double effect
let _inflight: Promise<string> | null = null;

/**
 * Returns today's AI-generated headline.
 * - Hits localStorage first — only calls the edge function once per day.
 * - Returns `fallback` if unavailable (API error, no key, SSR).
 */
export async function getDailyHeadline(fallback: string): Promise<string> {
  if (typeof window === "undefined") return fallback;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return fallback;

  const dateKey = new Date().toDateString();
  const cacheKey = CACHE_PREFIX + dateKey;

  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  // Prune stale entries from previous days
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHE_PREFIX) && key !== cacheKey) {
      localStorage.removeItem(key);
    }
  }

  if (_inflight) return _inflight;

  _inflight = fetch(`${SUPABASE_URL}/functions/v1/ai-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: "headline" }),
  })
    .then((res) => {
      if (!res.ok) return fallback;
      return res.json().then((data) => {
        const headline: string =
          typeof data.headline === "string" ? data.headline.trim() : "";
        if (headline) localStorage.setItem(cacheKey, headline);
        return headline || fallback;
      });
    })
    .catch(() => fallback)
    .finally(() => { _inflight = null; });

  return _inflight;
}
