"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "New registrations", value: "new_lead" },
  { label: "Voucher created", value: "voucher_created" },
  { label: "Fee submitted", value: "fee_submitted" },
  { label: "Access granted", value: "access_granted" },
  { label: "Rejected", value: "rejected" },
  { label: "Pending clarification", value: "pending_clarification" },
];

export default function RegistrationLeadFilters({
  initialSearch,
  initialStatus,
  canSync,
  onFilterChange,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const [syncState, setSyncState] = useState({
    pending: false,
    message: "",
    tone: "neutral",
  });

  useEffect(() => {
    setSearch(initialSearch);
    setStatus(initialStatus);
  }, [initialSearch, initialStatus]);

  function replaceWithHash(nextParams) {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    router.replace(
      nextParams.toString() ? `${pathname}?${nextParams.toString()}${hash}` : `${pathname}${hash}`,
      { scroll: false }
    );
  }

  function applyFilters(nextSearch, nextStatus) {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedStatus = String(nextStatus || "").trim();

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }

    if (normalizedStatus) {
      params.set("status", normalizedStatus);
    } else {
      params.set("status", "all");
    }
    startTransition(() => {
      replaceWithHash(params);
      onFilterChange?.({ search: nextSearch, status: normalizedStatus || "all" });
      if (typeof window !== "undefined") {
        const hash = window.location.hash;
        if (hash) {
          document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  }

  async function handleSync() {
    setSyncState({
      pending: true,
      message: "",
      tone: "neutral",
    });

    try {
      const response = await fetch("/api/coordinator/registration-leads/sync", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Sync failed.");
      }

      setSyncState({
        pending: false,
        message: `${data.stats?.synced || 0} records synced, ${data.stats?.failed || 0} failed.`,
        tone: "success",
      });
      router.refresh();
    } catch (error) {
      setSyncState({
        pending: false,
        message: error instanceof Error ? error.message : "Sync failed.",
        tone: "error",
      });
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.6fr)]">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Search Registrations
            </span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyFilters(search.trim(), status);
                }
              }}
              placeholder="Student, class, parent, email, or phone"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Status
            </span>
            <select
              value={status}
              onChange={(event) => {
                const nextStatus = event.target.value;
                setStatus(nextStatus);
                applyFilters(search.trim(), nextStatus);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => applyFilters(search.trim(), status)}
            disabled={isPending}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Applying..." : "Apply filters"}
          </button>

          {canSync ? (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncState.pending}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {syncState.pending ? "Syncing..." : "Sync Google Sheet Records"}
            </button>
          ) : null}
        </div>
      </div>

      {syncState.message ? (
        <p
          className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
            syncState.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {syncState.message}
        </p>
      ) : null}
    </section>
  );
}
