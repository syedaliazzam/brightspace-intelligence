"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import AttendanceSummary from "@/components/parent/AttendanceSummary";

export default function ParentAttendancePage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], summary: {}, error: "" });

  async function load(childId = state.selectedChildId) {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const [childrenResponse, attendanceResponse] = await Promise.all([
      fetch("/api/parent/children", { cache: "no-store" }),
      fetch(`/api/parent/attendance${query}`, { cache: "no-store" }),
    ]);
    const childrenData = await childrenResponse.json();
    const attendanceData = await attendanceResponse.json();
    if (!childrenResponse.ok || !attendanceResponse.ok) throw new Error(childrenData?.message || attendanceData?.message || "Unable to load attendance.");
    setState({ children: childrenData.children || [], selectedChildId: childId || childrenData.children?.[0]?.id || "", items: attendanceData.items || [], summary: attendanceData.summary || {}, error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Attendance</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Participation records</h1>
      </section>
      <ChildSwitcher childrenList={state.children} value={state.selectedChildId} onChange={(id) => load(id).catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <AttendanceSummary summary={state.summary} items={state.items} />
    </div>
  );
}
