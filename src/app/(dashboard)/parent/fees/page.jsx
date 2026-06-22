"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import FeeStatusPanel from "@/components/parent/FeeStatusPanel";

export default function ParentFeesPage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], error: "" });

  async function load(childId = state.selectedChildId) {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const [childrenResponse, feesResponse] = await Promise.all([
      fetch("/api/parent/children", { cache: "no-store" }),
      fetch(`/api/parent/fees${query}`, { cache: "no-store" }),
    ]);
    const childrenData = await childrenResponse.json();
    const feesData = await feesResponse.json();
    if (!childrenResponse.ok || !feesResponse.ok) throw new Error(childrenData?.message || feesData?.message || "Unable to load fee records.");
    setState({ children: childrenData.children || [], selectedChildId: childId || childrenData.children?.[0]?.id || "", items: feesData.items || [], error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Fees</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Voucher and payment visibility</h1>
      </section>
      <ChildSwitcher childrenList={state.children} value={state.selectedChildId} onChange={(id) => load(id).catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <FeeStatusPanel items={state.items} />
    </div>
  );
}
