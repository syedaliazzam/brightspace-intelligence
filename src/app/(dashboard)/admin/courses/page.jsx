"use client";

import { useCallback, useEffect, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import CourseFormModal from "@/components/admin/CourseFormModal";

const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  if (text.toLowerCase() === "pending") return "Draft";

  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.subjectId) params.set("subjectId", filters.subjectId);
  return `admin-courses:${params.toString()}`;
}

function readCache(key) {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(key);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(key);
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function AdminCoursesPage() {
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    subjectId: "",
  });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ search: "", status: "", subjectId: "" }));

    return {
      loading: !cached,
      error: "",
      available: cached?.available !== false,
      items: cached?.items || [],
      subjects: cached?.subjects || [],
      schedules: cached?.schedules || [],
      summary: cached?.summary || { total: 0, active: 0, draft: 0, schedules: 0 },
    };
  });
  const [modal, setModal] = useState({ open: false, record: null });

  const load = useCallback(async (options = {}) => {
    const force = options.force === true;
    const cacheKey = getCacheKey(filters);

    setState((current) => ({ ...current, loading: true, error: "" }));

    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        setState({
          loading: false,
          error: "",
          available: cached.available !== false,
          items: cached.items || [],
          subjects: cached.subjects || [],
          schedules: cached.schedules || [],
          summary: cached.summary || { total: 0, active: 0, draft: 0, schedules: 0 },
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.subjectId) params.set("subjectId", filters.subjectId);

      const response = await fetch(`/api/admin/courses?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load classes.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        items: data.items || [],
        subjects: data.subjects || [],
        schedules: data.schedules || [],
        summary: data.summary || { total: 0, active: 0, draft: 0, schedules: 0 },
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load classes.",
        available: false,
        items: [],
        subjects: [],
        schedules: [],
        summary: { total: 0, active: 0, draft: 0, schedules: 0 },
      });
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Class Management
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Manage Academic Classes
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              View approved class levels, assigned subjects, and related lecture activity from one admin page.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModal({ open: true, record: null })}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create Class
          </button>
        </div>
      </section>

      <AdminDashboardCards
        items={[
          {
            key: "total",
            label: "Total Classes",
            value: state.summary.total,
            tone: "bg-slate-950 text-white",
          },
          {
            key: "active",
            label: "Active Classes",
            value: state.summary.active,
            tone: "bg-emerald-50 text-emerald-800",
          },
          {
            key: "draft",
            label: "Draft Classes",
            value: state.summary.draft,
            tone: "bg-amber-50 text-amber-800",
          },
          {
            key: "schedules",
            label: "Lecture schedules",
            value: state.summary.schedules,
            tone: "bg-sky-50 text-sky-800",
          },
        ]}
      />

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:p-5">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_220px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Search Classes
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Class name or description"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) => {
                setState((current) => ({ ...current, loading: true }));
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All statuses</option>
              <option value="pending">Draft</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Subject
            </span>
            <select
              value={filters.subjectId}
              onChange={(event) => {
                setState((current) => ({ ...current, loading: true }));
                setFilters((current) => ({
                  ...current,
                  subjectId: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All subjects</option>
              {state.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Apply
          </button>
        </form>
      </section>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div>
          <AdminDataTable
            columns={[
              {
                key: "name",
                label: "Class Name",
                render: (row) => (
                  <div>
                    <p className="font-semibold text-slate-950">{row.name}</p>
                  </div>
                ),
              },
              {
                key: "class_mode",
                label: "Class / Grade",
                render: (row) => row.class_mode || row.name || "-",
              },
              {
                key: "assigned_subjects",
                label: "Assigned Subjects",
                render: (row) => row.assigned_subjects || row.subject_name || "-",
              },
              {
                key: "status",
                label: "Status",
                render: (row) => formatLabel(row.status),
              },
              {
                key: "created_at",
                label: "Created Date",
                render: (row) => formatDate(row.created_at),
              },
            ]}
            rows={state.loading ? [] : state.items}
            emptyMessage={
              state.loading
                ? "Loading classes..."
                : "No classes matched the current filters."
            }
            actions={(row) => (
              <button
                type="button"
                onClick={() => setModal({ open: true, record: row })}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Edit
              </button>
            )}
          />
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="mb-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
              Lecture schedules
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Recent schedule view
            </h2>
          </div>
          <AdminDataTable
            columns={[
              { key: "title", label: "Title" },
              { key: "schedule_time", label: "Scheduled time" },
              {
                key: "status",
                label: "Status",
                render: (row) => formatLabel(row.status),
              },
            ]}
            rows={state.schedules}
            emptyMessage="No lecture schedule activity is available at the moment."
          />
        </div>
      </section>

      {modal.open ? (
        <CourseFormModal
          key={modal.record?.id || "create-course"}
          open={modal.open}
          record={modal.record}
          subjects={state.subjects}
          onClose={() => setModal({ open: false, record: null })}
          onSuccess={() => load({ force: true })}
        />
      ) : null}
    </div>
  );
}
