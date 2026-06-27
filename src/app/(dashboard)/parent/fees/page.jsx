"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import FeeStatusPanel from "@/components/parent/FeeStatusPanel";

export default function ParentFeesPage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], error: "", loading: true });

  async function loadChildren() {
    const childrenResponse = await fetch("/api/parent/children", { cache: "no-store" });
    const childrenData = await childrenResponse.json();
    if (!childrenResponse.ok) throw new Error(childrenData?.message || "Unable to load children.");
    setState((current) => ({ ...current, children: childrenData.children || [], selectedChildId: "", loading: false, error: "" }));
  }

  async function load(childId = state.selectedChildId) {
    if (!childId) {
      setState((current) => ({ ...current, items: [] }));
      return;
    }
    const query = `?childId=${encodeURIComponent(childId)}`;
    const feesResponse = await fetch(`/api/parent/fees${query}`, { cache: "no-store" });
    const feesData = await feesResponse.json();
    if (!feesResponse.ok) throw new Error(feesData?.message || "Unable to load fee records.");
    setState((current) => ({ ...current, items: feesData.items || [], error: "" }));
  }

  useEffect(() => {
    loadChildren().catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, []);

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Fees</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Voucher and payment visibility</h1>
      </section>
      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => {
          setState((current) => ({ ...current, selectedChildId: id }));
          load(id).catch((error) => setState((current) => ({ ...current, error: error.message })));
        }}
      />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {!state.selectedChildId ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-slate-600 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
          Please select a child first.
        </div>
      ) : (
        <FeeStatusPanel items={state.items} />
      )}
    </div>
  );
}
