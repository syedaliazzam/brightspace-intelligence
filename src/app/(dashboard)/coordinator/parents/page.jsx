"use client";

import { useEffect, useState } from "react";
import ParentTable from "@/components/coordinator/ParentTable";

const CACHE_TTL = 60 * 1000;

function getCacheKey(search) {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  return `coordinator-parents:${params.toString()}`;
}

function readCache(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(key);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorParentsPage() {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(() => {
    const cached = readCache(getCacheKey(""));
    return cached?.items || [];
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const cacheKey = getCacheKey(search);
      const cached = readCache(cacheKey);

      if (cached && active) {
        setItems(cached.items || []);
        setError("");
      }

      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const response = await fetch(`/api/coordinator/parents?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load parents.");
      }

      if (active) {
        writeCache(cacheKey, data);
        setItems(data.items || []);
        setError("");
      }
    }

    load().catch((loadError) => {
      if (active) {
        setError(loadError.message);
      }
    });

    return () => {
      active = false;
    };
  }, [search]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Parent records</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Family contact registry</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Keep parent contact details, relationship mapping, and linked student coverage easy to review during daily operations.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {items.length} parents loaded
          </div>
        </div>
      </section>
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-5">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search parents" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      </section>
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
      <ParentTable items={items} />
    </div>
  );
}
