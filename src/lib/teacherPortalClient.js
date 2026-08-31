"use client";

const responseCache = new Map();
const pendingResponses = new Map();

const RESPONSE_CACHE_TTL_MS = 60 * 1000;
const STORAGE_PREFIX = "teacher-portal-cache:";

function readStoredCache(key, ttlMs) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt >= ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStoredCache(key, data) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // Browser storage can fail in private mode; in-memory cache still de-dupes this session.
  }
}

export async function loadTeacherPortalJsonCached(url, { force = false, ttlMs = RESPONSE_CACHE_TTL_MS } = {}) {
  const key = String(url || "");
  const now = Date.now();
  const cached = responseCache.get(key);

  if (!force && cached && now - cached.cachedAt < ttlMs) {
    return cached.data;
  }

  if (!force) {
    const stored = readStoredCache(key, ttlMs);
    if (stored) {
      responseCache.set(key, { data: stored, cachedAt: Date.now() });
      return stored;
    }
  }

  if (!force && pendingResponses.has(key)) {
    return pendingResponses.get(key);
  }

  const request = fetch(key, { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to load data.");
      }
      responseCache.set(key, { data, cachedAt: Date.now() });
      writeStoredCache(key, data);
      return data;
    })
    .finally(() => {
      pendingResponses.delete(key);
    });

  pendingResponses.set(key, request);
  return request;
}
