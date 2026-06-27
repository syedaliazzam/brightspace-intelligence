"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import PaginationControls from "@/components/parent/PaginationControls";

export default function AttendanceSummary({ summary = {}, items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page]);

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Attendance</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          {summary.percentage || 0}% present
        </h2>
        <p className="mt-2 text-sm text-slate-600">{summary.present || 0} of {summary.total || 0} records marked present.</p>
      </div>
      <div className="space-y-3">
        {items.length ? (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Lecture</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleItems.map((item, index) => (
                    <tr key={`${item.id || "attendance"}-${index}`}>
                      <td className="px-4 py-4 font-semibold text-slate-950">{item.class_title || "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{item.subject_name || "Subject not set"}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
                      <td className="px-4 py-4 text-slate-600">{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > pageSize ? (
              <PaginationControls
                page={page}
                pageSize={pageSize}
                totalItems={items.length}
                onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
              />
            ) : null}
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No attendance records yet.</p>
        )}
      </div>
    </section>
  );
}
