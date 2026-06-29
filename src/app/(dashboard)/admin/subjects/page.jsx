"use client";

import { useCallback, useEffect, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";
import SubjectFormModal from "@/components/admin/SubjectFormModal";

const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.courseId) params.set("courseId", filters.courseId);
  return `admin-subjects:${params.toString()}`;
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

export default function AdminSubjectsPage() {
  const [filters, setFilters] = useState({ search: "", status: "", courseId: "" });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ search: "", status: "", courseId: "" }));

    return {
      loading: !cached,
      error: "",
      available: cached?.available !== false,
      classOptions: cached?.classOptions || [],
      items: cached?.items || [],
      summary: cached?.summary || { total: 0, active: 0, inactive: 0 },
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
          classOptions: cached.classOptions || [],
          items: cached.items || [],
          summary: cached.summary || { total: 0, active: 0, inactive: 0 },
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.courseId) params.set("courseId", filters.courseId);

      const response = await fetch(`/api/admin/subjects?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load subjects.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        classOptions: data.classOptions || [],
        items: data.items || [],
        summary: data.summary || { total: 0, active: 0, inactive: 0 },
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load subjects.",
        available: false,
        classOptions: [],
        items: [],
        summary: { total: 0, active: 0, inactive: 0 },
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
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Maintain the subject catalog
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Create and refine the academic subject structure that courses and classes will build on.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setModal({ open: true, record: null })}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Create subject
          </button>
        </div>
      </section>

      <AdminDashboardCards
        items={[
          {
            key: "total",
            label: "Total subjects",
            value: state.summary.total,
            tone: "bg-slate-950 text-white",
          },
          {
            key: "active",
            label: "Active subjects",
            value: state.summary.active,
            tone: "bg-emerald-50 text-emerald-800",
          },
          {
            key: "inactive",
            label: "Inactive subjects",
            value: state.summary.inactive,
            tone: "bg-amber-50 text-amber-800",
          },
          {
            key: "availability",
            label: "Catalog status",
            value: state.available ? "Ready" : "Pending",
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
              Search subjects
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
              placeholder="Name, code, or description"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Class
            </span>
            <select
              value={filters.courseId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  courseId: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All classes</option>
              {state.classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_level || item.title}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
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

      <AdminDataTable
        columns={[
          {
            key: "name",
            label: "Subject",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
              </div>
            ),
          },
          {
            key: "class_level",
            label: "Class",
            render: (row) => row.class_level || "-",
          },
          { key: "description", label: "Description" },
          {
            key: "status",
            label: "Status",
            render: (row) => formatLabel(row.status),
          },
        ]}
        rows={state.loading ? [] : state.items}
        emptyMessage={
          state.loading
            ? "Loading subjects..."
            : "No subjects matched the current view."
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

      {modal.open ? (
        <SubjectFormModal
          key={modal.record?.id || "create-subject"}
          open={modal.open}
          record={modal.record}
          classOptions={state.classOptions}
          onClose={() => setModal({ open: false, record: null })}
          onSuccess={() => load({ force: true })}
        />
      ) : null}
    </div>
  );
}
