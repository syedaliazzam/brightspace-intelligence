"use client";

import { useCallback, useEffect, useState } from "react";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import ParentTable from "@/components/coordinator/ParentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";

export default function CoordinatorParentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/parents", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load parents.");
    }

    setState({ items: data.items || [], loading: false, error: "" });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState({ items: [], loading: false, error: error.message })
    );
  }, [load]);

  return (
    <div className="space-y-6">
      <CoordinatorPortalNavbar />
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Parents</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Family registry</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Manage parent contact records and linked students.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading parents...</div> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={10}
        step={10}
        renderItems={(visibleItems) => <ParentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No parent records available."
      />
    </div>
  );
}
