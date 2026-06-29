"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

export default function AssignedStudentsTable({ items = [] }) {
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPage(1);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  const dedupedItems = useMemo(() => {
    const seen = new Map();
    for (const item of items) {
      const key = [
        item.id || "",
        item.subject_name || "",
        item.course_title || "",
      ].join("|");
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }, [items]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return dedupedItems.slice(startIndex, startIndex + pageSize);
  }, [dedupedItems, page]);

  const totalPages = Math.max(1, Math.ceil(dedupedItems.length / pageSize));

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Username</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleItems.length ? visibleItems.map((item) => (
              <tr key={[item.id || "", item.subject_name || "", item.course_title || ""].join("|")}><td className="px-3 py-4 font-semibold text-slate-950">{item.full_name}</td><td className="px-3 py-4 text-slate-600">{item.username || "-"}</td><td className="px-3 py-4 text-slate-600">{item.grade_level || "-"}</td><td className="px-3 py-4 text-slate-600">{item.subject_name || "-"}</td><td className="px-3 py-4 text-slate-600">{item.status}</td></tr>
            )) : <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No assigned students found.</td></tr>}
          </tbody>
        </table>
      </div>
      {dedupedItems.length > pageSize ? (
        <PaginationControls page={page} pageSize={pageSize} totalItems={dedupedItems.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
      ) : null}
    </section>
  );
}
