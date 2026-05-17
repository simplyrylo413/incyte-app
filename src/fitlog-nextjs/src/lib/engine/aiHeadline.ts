// Daily AI headline — fetches once per calendar day, caches in localStorage.
// Falls back to the static pool (todayHeadline()) on failure or while loading.

const CACHE_PREFIX = "fitlog_headline_";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Returns today's AI-generated headline.
 * - Hits localStorage first — only calls the edge function once per day.
 * - Returns `fallback` if unavailable (API error, no key, SSR).
 */
export async function getDailyHeadline(fallback: string): Promise<string> {
  if (typeof window === "undefined") return fallback;

  const dateKey = new Date().toDateString();
  const cacheKey = CACHE_PREFIX + dateKey;

  // Serve from cache if today's headline is already stored
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  // Prune yesterday's entries
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CACHE_PREFIX) && key !== cacheKey) {
      localStorage.removeItem(key);
    }
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ action: "headline" }),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const headline: string = typeof data.headline === "string" ? data.headline.trim() : "";
    if (!headline) return fallback;

    localStorage.setItem(cacheKey, headline);
    return headline;
  } catch {
    return fallback;
  }
}
