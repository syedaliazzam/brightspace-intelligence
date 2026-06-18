"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";

const CACHE_KEY = "coordinator-dashboard";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

function writeNamedCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorDashboardPage() {
  const [state, setState] = useState(() => {
    const cached = readCache();

    return {
      loading: !cached,
      error: "",
      stats: cached?.stats || null,
      recentLectures: cached?.recentLectures || [],
      recentLeads: cached?.recentLeads || [],
    };
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = readCache();

      if (cached && active) {
        setState({
          loading: false,
          error: "",
          stats: cached.stats || null,
          recentLectures: cached.recentLectures || [],
          recentLeads: cached.recentLeads || [],
        });
      }

      try {
        const response = await fetch("/api/coordinator/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load coordinator dashboard.");
        }

        if (active) {
          writeCache(data);
          setState({
            loading: false,
            error: "",
            stats: data.stats,
            recentLectures: data.recentLectures || [],
            recentLeads: data.recentLeads || [],
          });
        }

        void Promise.allSettled([
          fetch("/api/coordinator/students", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-students:", payload)),
          fetch("/api/coordinator/parents", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-parents:", payload)),
          fetch("/api/coordinator/teacher-assignments", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-teacher-assignments", payload)),
          fetch("/api/coordinator/lecture-schedules", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-lecture-schedules", payload)),
          fetch("/api/coordinator/lecture-verifications?status=pending", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-lecture-verifications:pending", payload)),
          fetch("/api/coordinator/reports", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("coordinator-reports", payload)),
        ]);
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load coordinator dashboard.",
            stats: null,
            recentLectures: [],
            recentLeads: [],
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = state.stats || {};

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Coordinator operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Daily command view
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Monitor intake, payments, access approvals, teacher activity, and lecture scheduling from one coordinated dashboard.
          </p>
        </div>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <CoordinatorStatsCards
        items={[
          { key: "newLeads", label: "New leads", value: state.loading ? "..." : stats.newLeads || 0 },
          { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
          { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
          { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
          { key: "todayClasses", label: "Today classes", value: state.loading ? "..." : stats.todayClasses || 0 },
          { key: "classesNeedingVerification", label: "Classes needing verification", value: state.loading ? "..." : stats.classesNeedingVerification || 0 },
          { key: "missedClasses", label: "Missed classes", value: state.loading ? "..." : stats.missedClasses || 0 },
          { key: "rescheduledClasses", label: "Rescheduled classes", value: state.loading ? "..." : stats.rescheduledClasses || 0 },
        ]}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Recent lectures</p>
          <div className="mt-4 space-y-3">
            {state.recentLectures.length ? state.recentLectures.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.student_name} with {item.teacher_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No lecture activity available.</p>}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Recent leads</p>
          <div className="mt-4 space-y-3">
            {state.recentLeads.length ? state.recentLeads.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-950">{item.student_name}</p>
                <p className="mt-1 text-sm text-slate-600">{item.parent_name || "Parent pending"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No lead activity available.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
