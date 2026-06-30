"use client";

import { useEffect, useMemo, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ParentStatsCards from "@/components/parent/ParentStatsCards";
import PaymentAccessGuard from "@/components/shared/PaymentAccessGuard";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";

export default function ParentDashboardPage() {
  const [showAllMonthlyChildren, setShowAllMonthlyChildren] = useState(false);
  const [state, setState] = useState({
    children: [],
    headlines: [],
    selectedChildId: "",
    stats: {},
    error: "",
    loading: true,
    monthlyFee: null,
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

  async function loadMonthlyFee() {
    const response = await fetch("/api/monthly-fee-status", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to load monthly fee status.");
    }
    setState((current) => ({ ...current, monthlyFee: data.available ? data : null }));
  }

  const visibleMonthlyChildren = useMemo(() => {
    const children = Array.isArray(state.monthlyFee?.children) ? state.monthlyFee.children : [];
    return showAllMonthlyChildren ? children : children.slice(0, 4);
  }, [showAllMonthlyChildren, state.monthlyFee]);

  const hasUnpaidMonthlyChildren = useMemo(() => {
    const children = Array.isArray(state.monthlyFee?.children) ? state.monthlyFee.children : [];
    return children.some((child) => !child?.is_paid);
  }, [state.monthlyFee]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      Promise.all([loadChildren(), loadHeadlines(), loadMonthlyFee()]).catch((error) =>
        setState((current) => ({ ...current, loading: false, error: error.message }))
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <PaymentAccessGuard>
      <div className="space-y-6 min-h-screen">
      {state.monthlyFee && hasUnpaidMonthlyChildren ? (
        <section className={`w-full rounded-2xl border px-4 py-3 text-sm shadow-sm ${
          state.monthlyFee.overdue
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : state.monthlyFee.due_soon
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-sky-200 bg-sky-50 text-sky-700"
        }`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium">
                <p>
                  {state.monthlyFee.message || "Monthly fee voucher is not submitted yet. Please submit to continue LMS access."}
                </p>
                {typeof state.monthlyFee.days_left === "number" ? (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em]">
                    {state.monthlyFee.days_left >= 0
                      ? `${state.monthlyFee.days_left} day${state.monthlyFee.days_left === 1 ? "" : "s"} remaining`
                      : `${Math.abs(state.monthlyFee.days_left)} day${Math.abs(state.monthlyFee.days_left) === 1 ? "" : "s"} overdue`}
                  </p>
                ) : null}
              </div>
          </div>
            {Array.isArray(state.monthlyFee.children) && state.monthlyFee.children.length ? (
              <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/70">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-white/70 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Child</th>
                      <th className="px-4 py-3">Class</th>
                      <th className="px-4 py-3">Voucher</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Days</th>
                      <th className="px-4 py-3">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleMonthlyChildren.map((child) => (
                      <tr key={child.student_id || child.voucher_no}>
                        <td className="px-4 py-4 font-semibold text-slate-950">{child.student_name || "Not available"}</td>
                        <td className="px-4 py-4 text-slate-600">{child.class_title || "Not assigned"}</td>
                        <td className="px-4 py-4 text-slate-600">{child.voucher_no || "-"}</td>
                        <td className="px-4 py-4 text-slate-600">{child.due_date ? new Date(child.due_date).toLocaleDateString() : "-"}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {typeof child.days_left === "number"
                            ? child.days_left >= 0
                              ? `${child.days_left} day${child.days_left === 1 ? "" : "s"} left`
                              : `${Math.abs(child.days_left)} day${Math.abs(child.days_left) === 1 ? "" : "s"} overdue`
                            : "-"}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          {child.is_paid
                            ? "Verified"
                            : child.overdue
                              ? "Overdue"
                              : child.due_soon
                                ? "Due soon"
                                : String(child.payment_status || "Not submitted")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {state.monthlyFee.children.length > 4 ? (
                  <div className="border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setShowAllMonthlyChildren((current) => !current)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {showAllMonthlyChildren ? "Show less" : `Show more (${state.monthlyFee.children.length - 4} more)`}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <ActiveHeadlinesBanner items={state.headlines} />
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Child learning overview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
          Monitor classes, homework, attendance, fee status, and upcoming Google Meet sessions in one place.
        </p>
      </section>

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
