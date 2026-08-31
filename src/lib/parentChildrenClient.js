"use client";

let cachedChildren = null;
let cachedAt = 0;
let pendingRequest = null;
const responseCache = new Map();
const pendingResponses = new Map();

const CACHE_TTL_MS = 5 * 60 * 1000;
const RESPONSE_CACHE_TTL_MS = 60 * 1000;
const STORAGE_PREFIX = "parent-portal-cache:";

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

export function getInitialSelectedChildId(children = [], currentValue = "") {
  if (currentValue) return String(currentValue);
  return children.length === 1 ? String(children[0]?.id || "") : "";
}

export async function loadParentChildrenCached({ force = false } = {}) {
  const now = Date.now();
  if (!force && Array.isArray(cachedChildren) && now - cachedAt < CACHE_TTL_MS) {
    return cachedChildren;
  }

  if (!force) {
    const storedChildren = readStoredCache("children", CACHE_TTL_MS);
    if (Array.isArray(storedChildren)) {
      cachedChildren = storedChildren;
      cachedAt = Date.now();
      return cachedChildren;
    }
  }

  if (!force && pendingRequest) {
    return pendingRequest;
  }

  pendingRequest = fetch("/api/parent/children", { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || "Unable to load children.");
      }
      cachedChildren = Array.isArray(data.children) ? data.children : [];
      cachedAt = Date.now();
      writeStoredCache("children", cachedChildren);
      return cachedChildren;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

export async function loadParentPortalJsonCached(url, { force = false, ttlMs = RESPONSE_CACHE_TTL_MS } = {}) {
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
