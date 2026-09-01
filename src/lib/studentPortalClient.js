"use client";

const responseCache = new Map();
const pendingResponses = new Map();

const RESPONSE_CACHE_TTL_MS = 60 * 1000;
const STORAGE_PREFIX = "student-portal-cache:";

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
    // Ignore storage quota/private-mode failures; in-memory cache still helps.
  }
}

export async function loadStudentPortalJsonCached(url, { force = false, ttlMs = RESPONSE_CACHE_TTL_MS } = {}) {
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

export function clearStudentPortalCache() {
  responseCache.clear();
  pendingResponses.clear();

  if (typeof window === "undefined") return;

  try {
    Object.keys(window.sessionStorage).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        window.sessionStorage.removeItem(key);
      }
    });
  } catch {
    // Logout should continue even if storage is unavailable.
  }
}
