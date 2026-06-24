"use client";

import { useCallback, useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import LectureVerificationTable from "@/components/coordinator/LectureVerificationTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";

const CACHE_TTL = 60 * 1000;

function getCacheKey(filter) {
  return `coordinator-lecture-verifications:${filter || "pending"}`;
}

function readCache(key) {
  if (typeof window === "undefined") return null;

  const cached = window.sessionStorage.getItem(key);
  if (!cached) return null;

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
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), payload }));
}

export default function CoordinatorLectureVerificationsPage() {
  const [filter, setFilter] = useState("pending");
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey("pending"));

    return {
      counts: cached?.counts || { pending: 0, verified: 0, rejected: 0 },
      items: cached?.items || [],
      loading: !cached,
      error: "",
    };
  });

  const load = useCallback(async (nextFilter = filter) => {
    const cacheKey = getCacheKey(nextFilter);
    const cached = readCache(cacheKey);

    if (cached) {
      setState({
        counts: cached.counts || { pending: 0, verified: 0, rejected: 0 },
        items: cached.items || [],
        loading: false,
        error: "",
      });
    } else {
      setState((current) => ({ ...current, loading: true }));
    }

    const response = await fetch(`/api/coordinator/lecture-verifications?status=${nextFilter}`, {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load lecture verifications.");
    }

    writeCache(cacheKey, data);
    setState({
      counts: data.counts || { pending: 0, verified: 0, rejected: 0 },
      items: data.items || [],
      loading: false,
      error: "",
    });
  }, [filter]);

  useEffect(() => {
    load(filter).catch((error) =>
      setState((current) => ({ ...current, loading: false, error: error.message }))
    );
  }, [filter, load]);

  return (
    <div className="min-h-screen space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Approve class delivery outcomes</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Review teacher completion submissions, attendance signals, and final coordinator decisions.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {state.items.length} verification records loaded
          </div>
        </div>
      </section>

      <CoordinatorStatsCards
        items={[
          { key: "pending", label: "Pending", value: state.counts.pending },
          { key: "verified", label: "Verified", value: state.counts.verified },
          { key: "rejected", label: "Rejected or missed", value: state.counts.rejected },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        {["pending", "verified", "rejected"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filter === item
                ? "bg-slate-950 text-white"
                : "bg-white text-slate-700 ring-1 ring-inset ring-slate-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading lecture verifications...</div> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => (
          <LectureVerificationTable
            items={visibleItems}
            onRefresh={() => load(filter).catch((error) => window.alert(error.message))}
          />
        )}
        emptyMessage="No lecture verification records available."
      />
    </div>
  );
}
