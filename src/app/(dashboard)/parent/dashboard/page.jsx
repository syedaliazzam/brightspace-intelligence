"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ParentStatsCards from "@/components/parent/ParentStatsCards";
import PaymentAccessGuard from "@/components/shared/PaymentAccessGuard";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";

export default function ParentDashboardPage() {
  const [state, setState] = useState({
    children: [],
    headlines: [],
    selectedChildId: "",
    stats: {},
    error: "",
    loading: true,
  });

  async function loadChildren() {
    const response = await fetch("/api/parent/children", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load children.");
    }
    setState((current) => ({
      ...current,
      children: data.children || [],
      selectedChildId: "",
      loading: false,
      error: "",
    }));
  }

  async function loadHeadlines() {
    const response = await fetch("/api/headlines/active", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load headlines.");
    }

    setState((current) => ({
      ...current,
      headlines: Array.isArray(data.headlines) ? data.headlines : [],
    }));
  }

  async function loadDashboard(childId = state.selectedChildId) {
    if (!childId) {
      setState((current) => ({ ...current, stats: {}, error: "" }));
      return;
    }

    const response = await fetch(`/api/parent/dashboard?childId=${encodeURIComponent(childId)}`, { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load dashboard.");
    }

    setState((current) => ({
      ...current,
      headlines: Array.isArray(data.headlines) ? data.headlines : current.headlines,
      stats: data.stats || {},
      error: "",
    }));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadChildren(), loadHeadlines()]).catch((error) =>
        setState((current) => ({ ...current, loading: false, error: error.message }))
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <PaymentAccessGuard>
      <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Parent dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Child learning overview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Monitor classes, homework, attendance, fee status, and upcoming Google Meet sessions in one place.
        </p>
      </section>

      <ActiveHeadlinesBanner items={state.headlines} />

      <ParentStatsCards
        items={[
          { key: "children", label: "Total children", value: state.children.length || 0 },
        ]}
      />

      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => {
          setState((current) => ({ ...current, selectedChildId: id }));
          loadDashboard(id).catch((error) => setState((current) => ({ ...current, error: error.message })));
        }}
      />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

      {!state.selectedChildId ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-slate-600 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
          Please select a child first.
        </div>
      ) : (
        <ParentStatsCards
          items={[
            { key: "attended", label: "Attended lectures", value: state.stats.present_lectures || 0 },
            { key: "homework", label: "Pending homework", value: state.stats.pending_homework || 0 },
            { key: "attendance", label: "Attendance", value: `${state.stats.attendance_percentage || 0}%` },
            { key: "fees", label: "Fee status", value: state.stats.fee_status || "not_available" },
          ]}
        />
      )}
      </div>
    </PaymentAccessGuard>
  );
}
