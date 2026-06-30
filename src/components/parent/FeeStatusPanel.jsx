"use client";

import { useMemo, useState } from "react";
import PaginationControls from "@/components/parent/PaginationControls";

export default function FeeStatusPanel({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(() => {
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, totalPages]);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Fees</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Voucher and payment status</h2>
      </div>
      <div className="grid gap-4">
        {visibleItems.length ? visibleItems.map((item, index) => (
          <article key={`${item.id || "fee"}-${item.transaction_id || "voucher"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{item.voucher_no || "No voucher number"}</p>
                  {item.is_monthly_voucher ? (
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                      Monthly
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">Student: {item.student_name || "-"}</p>
                <p className="mt-1 text-sm text-slate-600">Amount: PKR {item.amount || item.paid_amount || "0"}</p>
                <p className="mt-1 text-sm text-slate-500">Transaction: {item.transaction_id || "Not submitted"}</p>
                {item.paid_amount ? <p className="mt-1 text-sm text-slate-500">Paid amount: {item.paid_amount}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 text-right">
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Voucher status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{item.voucher_status || "not_available"}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Payment status</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{item.submission_status || "not submitted"}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment proof</p>
              {item.proof_url ? (
                <a href={item.proof_url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <img src={item.proof_url} alt={`Payment proof for ${item.voucher_no}`} className="h-48 w-full object-contain" />
                </a>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">Payment proof has not been uploaded yet.</p>
              )}
            </div>
          </article>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            No fee records are available yet.
          </p>
        )}
      </div>
      {items.length > pageSize ? (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={items.length}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
        />
      ) : null}
    </section>
  );
}
