"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ParentTable from "@/components/coordinator/ParentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";

export default function CoordinatorParentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [search, setSearch] = useState("");

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

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();

    return state.items.filter((item) => {
      if (!term) return true;
      const name = String(item.full_name || "").toLowerCase();
      const email = String(item.email || item.parent_email || "").toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [state.items, search]);

  return (
    <div className="min-h-screen space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Family registry</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Manage parent contact records and linked students.
        </p>
        <div className="mt-6">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Search parent name or email</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by parent name or email"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </label>
        </div>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading parents...</div> : null}
      <ShowMoreSection
        items={filteredItems}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <ParentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No parent records available."
      />
    </div>
  );
}
