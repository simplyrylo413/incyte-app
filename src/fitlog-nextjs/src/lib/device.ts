// device_id helper for anonymous Supabase access during build/test phase.
// Mirrors the HTML build's DEVICE_ID pattern in fitlog-mobile.html (see
// const DEVICE_ID = ... around line 10100). Each browser/device gets a
// stable uuid stored in localStorage; Supabase rows are filtered by this
// id rather than auth.uid().
//
// At launch (Phase 8) this is replaced with auth.uid()-based access and a
// one-time migration adopts each device_id's rows under the logged-in
// user_id.

const DEVICE_ID_KEY = "fitlog_device_id";

function newDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older environments — sufficient for an opaque id.
  return "dev_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Browser-side device id. Generates + persists on first call.
 * Safe to call from client components only; will throw on the server.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    throw new Error("getDeviceId() is browser-only — call from a client component");
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = newDeviceId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Browser-side device id, but returns null on the server instead of throwing.
 * Use in code paths that may run during SSR.
 */
export function tryGetDeviceId(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }
  return getDeviceId();
}
