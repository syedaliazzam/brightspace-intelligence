"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import AttendanceSummary from "@/components/parent/AttendanceSummary";

export default function ParentAttendancePage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], summary: {}, error: "", loading: true });

  async function loadChildren() {
    const childrenResponse = await fetch("/api/parent/children", { cache: "no-store" });
    const childrenData = await childrenResponse.json();
    if (!childrenResponse.ok) throw new Error(childrenData?.message || "Unable to load children.");
    setState((current) => ({ ...current, children: childrenData.children || [], selectedChildId: "", loading: false, error: "" }));
  }

  async function load(childId = state.selectedChildId) {
    if (!childId) {
      setState((current) => ({ ...current, items: [], summary: {} }));
      return;
    }
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const attendanceResponse = await fetch(`/api/parent/attendance${query}`, { cache: "no-store" });
    const attendanceData = await attendanceResponse.json();
    if (!attendanceResponse.ok) throw new Error(attendanceData?.message || "Unable to load attendance.");
    setState((current) => ({ ...current, items: attendanceData.items || [], summary: attendanceData.summary || {}, error: "" }));
  }

  useEffect(() => {
    loadChildren().catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }, []);

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Attendance</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Participation records</h1>
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
        <AttendanceSummary summary={state.summary} items={state.items} />
      )}
    </div>
  );
}
