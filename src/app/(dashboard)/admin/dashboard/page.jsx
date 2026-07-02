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
      tone: "bg-[#0D5C48] text-[#FAF7F0]",
    },
    {
      key: "activeUsers",
      label: "Active users",
      value: Number(overview.activeUsers || 0),
      tone: "bg-emerald-50 text-emerald-800",
    },
    {
      key: "newLeads",
      label: "New Admissions",
      value: Number(overview.newRegistrationLeads || 0),
      tone: "bg-[#EAF6EF] text-[#0D5C48]",
    },
    {
      key: "classes",
      label: "Classes",
      value: Number(state.data?.system?.courseCount || 0),
      tone: "bg-[#FFF5D6] text-[#8A6B00]",
    },
    {
      key: "subjects",
      label: "Subjects",
      value: Number(state.data?.system?.subjectCount || 0),
      tone: "bg-[#FFF5D6] text-[#8A6B00]",
    },
  ];

  return (
    <div className="rounded-[2rem] border-0 min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 rounded-[2rem] absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative border-0 rounded-[2rem] mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="max-w-3xl">
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Platform command center
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
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
        <div className="space-y-4 rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
              Active role coverage
            </h2>
          </div>
          <AdminDataTable
            columns={[
              {
                key: "role",
                label: "Role",
                render: (row) => (
                  <span className="font-semibold text-[#063F32]">
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
        <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="mb-4">
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
              Admission Records
            </h2>
          </div>
          <AdminDataTable
            columns={[
              { key: "student_name", label: "Student" },
              { key: "parent_name", label: "Parent" },
              { key: "class_level", label: "Class" },
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
      </section>
      </div>
    </div>
  );
}
