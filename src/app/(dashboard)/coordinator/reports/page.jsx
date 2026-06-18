"use client";

import { useEffect, useState } from "react";
import CoordinatorReportsPanel from "@/components/coordinator/CoordinatorReportsPanel";

const CACHE_KEY = "coordinator-reports";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorReportsPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: {
      registrationPipeline: [],
      feeVerification: [],
      lectureCompletion: [],
      teacherClassReport: [],
      studentActivity: [],
    },
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = readCache();

      if (cached && active) {
        setState({
          loading: false,
          error: "",
          data: cached,
        });
      }

      const response = await fetch("/api/coordinator/reports", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load coordinator reports.");
      }

      if (active) {
        writeCache(data);
        setState({
          loading: false,
          error: "",
          data,
        });
      }
    }

    load().catch((error) => {
      if (active) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Reports</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Coordinator performance and pipeline reports</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Track conversion, payment quality, class delivery, and teacher utilization through a clean operational reporting view.
            </p>
          </div>
        </div>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading reports...</div> : null}
      {!state.loading ? <CoordinatorReportsPanel data={state.data} /> : null}
    </div>
  );
}
