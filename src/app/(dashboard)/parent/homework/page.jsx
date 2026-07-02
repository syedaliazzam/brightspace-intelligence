"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import HomeworkList from "@/components/parent/HomeworkList";

export default function ParentHomeworkPage() {
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
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const homeworkResponse = await fetch(`/api/parent/homework${query}`, { cache: "no-store" });
    const homeworkData = await homeworkResponse.json();
    if (!homeworkResponse.ok) throw new Error(homeworkData?.message || "Unable to load homework.");
    setState((current) => ({ ...current, items: homeworkData.items || [], error: "" }));
  }

  useEffect(() => {
    loadChildren().catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, []);

  return (
    <div className="relative rounded-[2rem] min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em]">Parent homework</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Assigned learning tasks</h1>
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
        <div className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-8 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          Please select a child first.
        </div>
      ) : (
        <HomeworkList items={state.items} />
      )}
      </div>
    </div>
  );
}
