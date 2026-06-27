"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";
import PaginationControls from "@/components/parent/PaginationControls";

export default function ParentClassesTable({ items = [] }) {
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
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Lecture records
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Scheduled and completed lectures
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-3 py-3">Lecture</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Teacher</th>
              <th className="px-3 py-3">Schedule</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-4 font-semibold text-slate-950">{item.title}</td>
                <td className="px-3 py-4 text-slate-600">{item.subject_name}</td>
                <td className="px-3 py-4 text-slate-600">{item.teacher_name}</td>
                <td className="px-3 py-4 text-slate-600">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
                <td className="px-3 py-4 text-slate-600">{item.display_status || getLectureDisplayStatus(item)}</td>
                <td className="px-3 py-4">
                  <div className="flex flex-wrap gap-2">
                    {canShowJoinMeet(item) ? <a className="font-semibold text-sky-700" href={item.google_meet_link} target="_blank" rel="noreferrer">Meet</a> : null}
                    {item.recording_drive_url ? <a className="font-semibold text-sky-700" href={item.recording_drive_url} target="_blank" rel="noreferrer">Recording</a> : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={6}>No lecture records found.</td></tr>
            )}
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
    </section>
  );
}
