"use client";

import { useEffect, useState } from "react";
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
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Operational reports</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Review registration, payment, staffing, and lecture activity snapshots.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading reports...</div> : null}
      {state.data ? <CoordinatorReportsPanel data={state.data} /> : null}
    </div>
  );
}
