"use client";

import { useCallback, useEffect, useState } from "react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";

const CACHE_TTL = 60 * 1000;

function formatLabel(value) {
  const text = String(value || "");
  return text
    ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
    : "-";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.action) params.set("action", filters.action);
  if (filters.entityType) params.set("entityType", filters.entityType);
  return `admin-audit-logs:${params.toString()}`;
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

export default function AdminAuditLogsPage() {
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    entityType: "",
  });
  const [state, setState] = useState(() => {
    const cached = readCache(
      getCacheKey({ search: "", action: "", entityType: "" })
    );

    return {
      loading: !cached,
      error: "",
      available: cached?.available !== false,
      actions: cached?.actions || [],
      entityTypes: cached?.entityTypes || [],
      items: cached?.items || [],
      summary: cached?.summary || { total: 0, recent: 0 },
    };
  });

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
          actions: cached.actions || [],
          entityTypes: cached.entityTypes || [],
          items: cached.items || [],
          summary: cached.summary || { total: 0, recent: 0 },
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.action) params.set("action", filters.action);
      if (filters.entityType) params.set("entityType", filters.entityType);

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load audit logs.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        available: data.available !== false,
        actions: data.actions || [],
        entityTypes: data.entityTypes || [],
        items: data.items || [],
        summary: data.summary || { total: 0, recent: 0 },
      });
    } catch (error) {
      setState({
        loading: false,
        error:
          error instanceof Error ? error.message : "Unable to load audit logs.",
        available: false,
        actions: [],
        entityTypes: [],
        items: [],
        summary: { total: 0, recent: 0 },
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
        <div className="max-w-3xl">
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Review admin actions and change history
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Track administrative activity across users, subjects, courses, finance settings, and system operations.
          </p>
        </div>
      </section>

      <AdminDashboardCards
        items={[
          {
            key: "total",
            label: "Visible records",
            value: state.summary.total,
            tone: "bg-slate-950 text-white",
          },
          {
            key: "recent",
            label: "Last 7 days",
            value: state.summary.recent,
            tone: "bg-sky-50 text-sky-800",
          },
          {
            key: "status",
            label: "Section status",
            value: state.available ? "Ready" : "Pending",
            tone: "bg-amber-50 text-amber-800",
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
              Search logs
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
              placeholder="Action, entity, or description"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Action
            </span>
            <select
              value={filters.action}
              onChange={(event) => {
                setState((current) => ({ ...current, loading: true }));
                setFilters((current) => ({
                  ...current,
                  action: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All actions</option>
              {state.actions.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Entity type
            </span>
            <select
              value={filters.entityType}
              onChange={(event) => {
                setState((current) => ({ ...current, loading: true }));
                setFilters((current) => ({
                  ...current,
                  entityType: event.target.value,
                }));
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All entity types</option>
              {state.entityTypes.map((item) => (
                <option key={item} value={item}>
                  {formatLabel(item)}
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

      <AdminDataTable
        columns={[
          {
            key: "action",
            label: "Action",
            render: (row) => formatLabel(row.action),
          },
          { key: "entity_type", label: "Entity" },
          { key: "actor_name", label: "Actor" },
          { key: "description", label: "Description" },
          {
            key: "created_at",
            label: "Created",
            render: (row) => formatDate(row.created_at),
          },
        ]}
        rows={state.loading ? [] : state.items}
        emptyMessage={
          state.loading
            ? "Loading audit logs..."
            : "No audit activity matched the current view."
        }
      />
    </div>
  );
}
