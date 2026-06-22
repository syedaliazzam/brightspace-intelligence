"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const STATUS_OPTIONS = [
  { label: "All voucher statuses", value: "" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Submitted", value: "submitted" },
  { label: "Verified", value: "verified" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
];

export default function FeeVoucherFilters({ initialSearch, initialStatus }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);

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

    if (nextSearch) {
      params.set("search", nextSearch);
    } else {
      params.delete("search");
    }

    if (nextStatus) {
      params.set("status", nextStatus);
    } else {
      params.delete("status");
    }
    startTransition(() => {
      replaceWithHash(params);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: window.scrollY, behavior: "smooth" });
        });
      }
    });
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px_auto]">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Search vouchers
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
            placeholder="Voucher no, student, parent, phone, or email"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Voucher status
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

        <button
          type="button"
          onClick={() => applyFilters(search.trim(), status)}
          disabled={isPending}
          className="mt-7 inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Applying..." : "Apply"}
        </button>
      </div>
    </section>
  );
}
