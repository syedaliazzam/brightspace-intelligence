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
  const [state, setState] = useState({
    counts: { pending: 0, verified: 0, rejected: 0 },
    items: [],
    loading: true,
    error: "",
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
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(101,184,145,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(201,162,39,0.12),transparent_24%),#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,rgba(13,59,46,0.96),rgba(13,92,72,0.95))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(6,63,50,0.45)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Approve class delivery outcomes</h1>
            <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
              Review teacher completion submissions, attendance signals, and final coordinator decisions.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 text-sm text-[#FAF7F0]">
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
      {["pending", "verified", "rejected", "all"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === item
                ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32]"
                : "bg-white text-[#245C4F] ring-1 ring-inset ring-[#2D8A6A]/20"
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
    </div>
  );
}
