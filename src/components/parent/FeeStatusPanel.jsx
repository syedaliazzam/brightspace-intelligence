"use client";

import { useMemo, useState } from "react";
import PaginationControls from "@/components/parent/PaginationControls";

export default function FeeStatusPanel({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  const formatMoney = (value) => Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(() => {
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page, totalPages]);

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Fees</p>
        <h2 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">Voucher and payment status</h2>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed border-separate border-spacing-0">
            <thead className="bg-[#FAF7F0]">
              <tr className="text-left text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                <th className="w-[14%] px-4 py-3">Voucher</th>
                <th className="w-[18%] px-4 py-3">Student</th>
                <th className="w-[13%] px-4 py-3">Scholarship</th>
                <th className="w-[12%] px-4 py-3">Amount</th>
                <th className="w-[12%] px-4 py-3">Paid amount</th>
                <th className="w-[13%] px-4 py-3">Remaining due</th>
                <th className="w-[12%] px-4 py-3">Payment status</th>
                <th className="w-[6%] px-4 py-3">Proof</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length ? visibleItems.map((item, index) => (
                <tr key={`${item.id || "fee"}-${item.transaction_id || "voucher"}-${index}`} className="border-t border-[#F1EADC] bg-white align-top">
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="whitespace-nowrap font-semibold text-[#063F32]">{item.voucher_no || "No voucher number"}</p>
                      {item.is_monthly_voucher ? (
                        <span className="inline-flex rounded-full bg-[#E9F8F1] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                          Monthly
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#245C4F] align-top whitespace-normal break-words">{item.student_name || "-"}</td>
                  <td className="px-4 py-4 text-sm text-[#245C4F] align-top whitespace-nowrap">
                    {Number(item.scholarship_amount || 0) > 0 ? `PKR ${formatMoney(item.scholarship_amount)}` : "-"}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#245C4F] align-top whitespace-nowrap">PKR {formatMoney(item.amount || item.paid_amount || 0)}</td>
                  <td className="px-4 py-4 text-sm text-[#245C4F] align-top whitespace-nowrap">PKR {formatMoney(item.paid_amount || 0)}</td>
                  <td className="px-4 py-4 text-sm text-[#245C4F] align-top whitespace-nowrap">
                    {item.is_monthly_voucher ? `PKR ${formatMoney(item.remaining_due || 0)}` : Number(item.remaining_due || 0) > 0 ? `PKR ${formatMoney(item.remaining_due || 0)}` : "-"}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-[#063F32] align-top whitespace-nowrap">{item.submission_status || "not submitted"}</td>
                  <td className="px-4 py-4 align-top">
                    {item.proof_url ? (
                      <a
                        href={item.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-sm transition hover:scale-[1.02]"
                        title="Open payment proof"
                      >
                        <img src={item.proof_url} alt={`Payment proof for ${item.voucher_no}`} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <span className="text-sm text-[#245C4F]">No proof</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-sm text-[#245C4F]">
                    No fee records are available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {false ? null : null}
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
