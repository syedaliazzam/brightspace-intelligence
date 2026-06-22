"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ParentStatsCards from "@/components/parent/ParentStatsCards";
import UpcomingClassesCard from "@/components/parent/UpcomingClassesCard";

export default function ParentDashboardPage() {
  const [state, setState] = useState({
    children: [],
    selectedChildId: "",
    stats: {},
    upcoming: [],
    nextClass: null,
    error: "",
  });

  async function load(childId = state.selectedChildId) {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const response = await fetch(`/api/parent/dashboard${query}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load dashboard.");
    }

    setState({
      children: data.children || [],
      selectedChildId: data.selectedChildId || childId || data.children?.[0]?.id || "",
      stats: data.stats || {},
      upcoming: data.upcoming || [],
      nextClass: data.nextClass || null,
      error: "",
    });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Parent dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Child learning overview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Monitor classes, homework, attendance, fee status, and upcoming Google Meet sessions in one place.
        </p>
      </section>

      <ChildSwitcher childrenList={state.children} value={state.selectedChildId} onChange={(id) => load(id).catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

      <ParentStatsCards
        items={[
          { key: "children", label: "Total children", value: state.stats.total_children || 0 },
          { key: "upcoming", label: "Upcoming Lectures", value: state.stats.upcoming_classes || 0 },
          { key: "completed", label: "Completed lectures", value: state.stats.completed_classes || 0 },
          { key: "homework", label: "Pending homework", value: state.stats.pending_homework || 0 },
          { key: "attendance", label: "Attendance", value: `${state.stats.attendance_percentage || 0}%` },
          { key: "fees", label: "Fee status", value: state.stats.fee_status || "not_available" },
          { key: "next", label: "Next Lecture", value: state.nextClass?.title || "None", helper: state.nextClass?.subject_name || "" },
        ]}
      />

      <UpcomingClassesCard items={state.upcoming} />
    </div>
  );
}
