"use client";

import { useEffect, useState } from "react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import CoordinatorReportsPanel from "@/components/coordinator/CoordinatorReportsPanel";

export default function CoordinatorReportsPage() {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const response = await fetch("/api/coordinator/reports", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load reports.");
      }

      if (active) {
        setState({ data, loading: false, error: "" });
      }
    }

    load().catch((error) => {
      if (active) {
        setState({ data: null, loading: false, error: error.message });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(101,184,145,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(201,162,39,0.12),transparent_24%),#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,rgba(13,59,46,0.96),rgba(13,92,72,0.95))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(6,63,50,0.45)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Operational reports</h1>
        <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
          Review registration, payment, staffing, and lecture activity snapshots.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <OpenBookLoader title="Loading reports" subtitle="Preparing coordinator reports..." /> : null}
      {state.data ? <CoordinatorReportsPanel data={state.data} /> : null}
      </div>
    </div>
  );
}
