"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ParentClassesTable from "@/components/parent/ParentClassesTable";

export default function ParentClassesPage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], period: "", error: "" });

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load(childId = state.selectedChildId, period = state.period) {
    const params = new URLSearchParams();
    if (childId) params.set("childId", childId);
    if (period) params.set("period", period);

    const [childrenResponse, classesResponse] = await Promise.all([
      fetch("/api/parent/children", { cache: "no-store" }),
      fetch(`/api/parent/lectures?${params.toString()}`, { cache: "no-store" }),
    ]);
    const childrenData = await readJson(childrenResponse);
    const classesData = await readJson(classesResponse);

    if (!childrenResponse.ok || !classesResponse.ok) {
      throw new Error(childrenData?.message || classesData?.message || "Unable to load classes.");
    }

    const selected = childId || childrenData.children?.[0]?.id || "";
    setState({ children: childrenData.children || [], selectedChildId: selected, items: classesData.items || [], period, error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Lectures</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Child lecture schedule and history</h1>
      </section>
      <ChildSwitcher childrenList={state.children} value={state.selectedChildId} onChange={(id) => load(id, state.period).catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      <div className="flex flex-wrap gap-2">
        {[
          ["", "All lectures"],
          ["upcoming", "Upcoming"],
          ["completed", "Completed"],
          ["current_week", "Current week"],
          ["next_week", "Next week"],
        ].map(([value, label]) => (
          <button key={value} onClick={() => load(state.selectedChildId, value).catch((error) => setState((current) => ({ ...current, error: error.message })))} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${state.period === value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <ParentClassesTable items={state.items} />
    </div>
  );
}
