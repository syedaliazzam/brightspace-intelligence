"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import AdminDashboardCards from "@/components/admin/AdminDashboardCards";
import AdminDataTable from "@/components/admin/AdminDataTable";

const CACHE_TTL = 60 * 1000;

function formatStatus(value) {
  const text = String(value || "");
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : "-";
}

function formatAmount(value) {
  const amount = Number(value || 0);
  return `PKR ${amount.toLocaleString("en-US")}`;
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getCacheKey(filters) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  return `admin-payments:${params.toString()}`;
}

function readCache(key) {
  if (typeof window === "undefined") return null;

  const cached = window.sessionStorage.getItem(key);
  if (!cached) return null;

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
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function AdminPaymentsPage() {
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [state, setState] = useState(() => {
    const cached = readCache(getCacheKey({ search: "", status: "" }));

    return {
      loading: !cached,
      error: "",
      items: cached?.items || [],
      counts: cached?.counts || { pending: 0, verified: 0, rejected: 0 },
      statuses: cached?.filters?.statuses || ["pending", "verified", "rejected"],
    };
  });
  const [statusOpen, setStatusOpen] = useState(false);
  function closeSelectState(setter) {
    window.setTimeout(() => setter(false), 0);
  }

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
          items: cached.items || [],
          counts: cached.counts || { pending: 0, verified: 0, rejected: 0 },
          statuses: cached.filters?.statuses || ["pending", "verified", "rejected"],
        });
        return;
      }
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);

      const response = await fetch(`/api/admin/payments?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load payments.");
      }

      writeCache(cacheKey, data);
      setState({
        loading: false,
        error: "",
        items: data.items || [],
        counts: data.counts || { pending: 0, verified: 0, rejected: 0 },
        statuses: data.filters?.statuses || ["pending", "verified", "rejected"],
      });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Unable to load payments.",
        items: [],
        counts: { pending: 0, verified: 0, rejected: 0 },
        statuses: ["pending", "verified", "rejected"],
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
    <div className="min-h-screen rounded-[2rem] bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="max-w-3xl">
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">
            Review payment records
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
            View submitted payment proofs and track pending, verified, and rejected payment records from one admin workspace.
          </p>
        </div>
      </section>

      <AdminDashboardCards
        items={[
          {
            key: "pending",
            label: "Pending",
            value: state.counts.pending,
            tone: "bg-[#FFF5D6] text-[#8A6B00]",
          },
          {
            key: "verified",
            label: "Verified",
            value: state.counts.verified,
            tone: "bg-[#EAF6EF] text-[#0D5C48]",
          },
          {
            key: "rejected",
            label: "Rejected",
            value: state.counts.rejected,
            tone: "bg-rose-50 text-rose-800",
          },
          {
            key: "visible",
            label: "Visible records",
            value: state.items.length,
            tone: "bg-[#0D5C48] text-[#FAF7F0]",
          },
        ]}
      />

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] sm:p-5">
        <form
          className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            load({ force: true });
          }}
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Search payments</span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Student, parent, transaction, or voucher"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#245C4F]">Status</span>
            <div className="relative">
              <select
                value={filters.status}
                onMouseDown={() => setStatusOpen((current) => !current)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => closeSelectState(setStatusOpen)}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
              >
                <option value="">All statuses</option>
                {state.statuses.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${statusOpen ? "rotate-180" : "rotate-0"}`} />
            </div>
          </label>

          <button
            type="submit"
            className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
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
            key: "student_name",
            label: "Student",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.student_name}</p>
                <p className="mt-1 text-sm text-slate-500">{row.parent_name || "Parent pending"}</p>
              </div>
            ),
          },
          {
            key: "voucher_no",
            label: "Voucher",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.voucher_no}</p>
                <p className="mt-1 text-sm text-slate-500">{formatAmount(row.voucher_amount)}</p>
              </div>
            ),
          },
          {
            key: "paid_amount",
            label: "Paid amount",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{formatAmount(row.paid_amount)}</p>
                <p className="mt-1 text-sm text-slate-500">{formatDate(row.paid_at)}</p>
              </div>
            ),
          },
          {
            key: "transaction_id",
            label: "Transaction",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.transaction_id || "-"}</p>
                <p className="mt-1 text-sm text-slate-500">{row.phone || row.email || "No contact"}</p>
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => formatStatus(row.status),
          },
          {
            key: "proof",
            label: "Proof",
            render: (row) =>
              row.proof_file_url ? (
                <a
                  href={row.proof_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-sky-700 hover:text-sky-800"
                >
                  View proof
                </a>
              ) : (
                "-"
              ),
          },
        ]}
        rows={state.loading ? [] : state.items}
        emptyMessage={state.loading ? "Loading payments..." : "No payment records matched the current filter."}
      />
      </div>
    </div>
  );
}
