"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";
import PaginationControls from "@/components/teacher/PaginationControls";

export default function TeacherClassTable({ items = [], onOpen }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  return (
    <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
            <tr><th className="px-3 py-3">Class</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Meet</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC]">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-4 font-semibold text-[#063F32]">{item.title}</td>
                <td className="px-3 py-4 text-[#245C4F]">{item.student_name}</td>
                <td className="px-3 py-4 text-[#245C4F]">{item.subject_name}</td>
              <td className="px-3 py-4 text-[#245C4F]">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
              <td className="px-3 py-4 text-[#245C4F]">
                {canShowJoinMeet(item) ? <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="font-semibold text-[#0D5C48]">Open</a> : "-"}
              </td>
              <td className="px-3 py-4 text-[#245C4F]">{item.display_status || getLectureDisplayStatus(item)}</td>
                <td className="px-3 py-4">
                  {["completed_by_teacher", "verified_by_coordinator"].includes(String(item.status || "").toLowerCase()) ? null : (
                    <button onClick={() => onOpen?.(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32]">Open</button>
                  )}
                </td>
              </tr>
            )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-[#245C4F]">No lectures found.</td></tr>}
          </tbody>
        </table>
      </div>
      {items.length > pageSize ? (
        <PaginationControls page={page} pageSize={pageSize} totalItems={items.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
      ) : null}
    </section>
  );
}
