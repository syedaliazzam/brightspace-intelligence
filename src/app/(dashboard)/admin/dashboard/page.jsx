"use client";

import { useEffect, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";

const CACHE_KEY = "admin-dashboard-stats";
const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

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

export default function AdminDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      const cached = readCache();

      if (cached) {
        setState({ loading: false, error: "", data: cached });
        return;
      }

      try {
        const response = await fetch("/api/admin/stats", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load dashboard insights.");
        }

        if (mounted) {
          writeCache(data);
          setState({ loading: false, error: "", data });
        }

        void Promise.allSettled([
          fetch("/api/admin/staff", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("admin-users:", payload)),
          fetch("/api/admin/subjects", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("admin-subjects:", payload)),
          fetch("/api/admin/courses", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("admin-courses:", payload)),
          fetch("/api/admin/fee-settings", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("admin-fee-settings", payload)),
          fetch("/api/admin/audit-logs", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => writeNamedCache("admin-audit-logs:", payload)),
        ]);
      } catch (error) {
        if (mounted) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load dashboard insights.",
            data: null,
          });
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const overview = state.data?.overview || {};
  const cards = [
    {
      key: "totalUsers",
      label: "Total users",
      value: Number(overview.totalUsers || 0),
      tone: "bg-slate-950 text-white",
    },
    {
      key: "activeUsers",
      label: "Active users",
      value: Number(overview.activeUsers || 0),
      tone: "bg-emerald-50 text-emerald-800",
    },
    {
      key: "newLeads",
      label: "New registration leads",
      value: Number(overview.newRegistrationLeads || 0),
      tone: "bg-sky-50 text-sky-800",
    },
    {
      key: "feeSubmissions",
      label: "Fee submissions",
      value: Number(overview.totalFeeSubmissions || 0),
      tone: "bg-amber-50 text-amber-800",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Executive overview
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Platform command center
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Review account growth, intake activity, finance progress, and operational readiness from one concise admin view.
          </p>
        </div>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <AdminDashboardCards
        items={
          state.loading
            ? cards.map((item) => ({ ...item, value: "..." }))
            : cards
        }
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Role management
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Active role coverage
            </h2>
          </div>
          <AdminDataTable
            columns={[
              {
                key: "role",
                label: "Role",
                render: (row) => (
                  <span className="font-semibold text-slate-950">
                    {formatLabel(row.role)}
                  </span>
                ),
              },
              { key: "total", label: "Total users" },
              { key: "activeTotal", label: "Active users" },
            ]}
            rows={state.data?.roles || []}
            emptyMessage="Role insights will appear here as account activity grows."
          />
        </div>

        <div className="space-y-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              System settings
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Operational readiness
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Subjects", state.data?.system?.subjectCount, state.data?.system?.subjectsEnabled],
              ["Courses", state.data?.system?.courseCount, state.data?.system?.coursesEnabled],
              ["Fee settings", state.data?.system?.feeSettingCount, state.data?.system?.feeSettingsEnabled],
              ["Lecture schedules", state.data?.system?.lectureScheduleCount, state.data?.system?.schedulesEnabled],
            ].map(([label, value, enabled]) => (
              <article
                key={label}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                  {state.loading ? "..." : Number(value || 0)}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {enabled ? "Connected to live records" : "Pending configuration"}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Registration leads
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Recent intake
            </h2>
          </div>
          <AdminDataTable
            columns={[
              { key: "student_name", label: "Student" },
              { key: "parent_name", label: "Parent" },
              {
                key: "status",
                label: "Status",
                render: (row) => formatLabel(row.status),
              },
            ]}
            rows={state.data?.recent?.registrationLeads || []}
            emptyMessage="No recent registration activity to display."
          />
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Audit logs
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Recent administrative activity
            </h2>
          </div>
          <AdminDataTable
            columns={[
              {
                key: "action",
                label: "Action",
                render: (row) => formatLabel(row.action),
              },
              { key: "entity_type", label: "Entity" },
              { key: "description", label: "Description" },
            ]}
            rows={state.data?.recent?.auditLogs || []}
            emptyMessage="No recent administrative activity to display."
          />
        </div>
      </section>
    </div>
  );
}
