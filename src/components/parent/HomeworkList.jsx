"use client";

import { formatDateTime } from "@/lib/dateTime";

export default function HomeworkList({ items = [] }) {
  return (
    <section className="grid gap-4">
      {items.length ? items.map((item, index) => (
        <article key={`${item.id || "homework"}-${index}`} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_55px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.subject_name} with Teacher: {item.teacher_name}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description || "No description provided."}</p>
              <p className="mt-3 text-sm text-slate-500">Created by: Teacher {item.teacher_name || "-"}</p>
              <p className="mt-1 text-sm text-slate-500">{item.status === "submitted" ? `Submitted by: Student ${item.student_name || "-"}` : "Submitted by: Not submitted yet"}</p>
            </div>
            <div className="text-sm text-slate-500 md:text-right">
              <p className="font-semibold text-slate-700">{item.status}</p>
              <p>{formatDateTime(item.due_date)}</p>
            </div>
          </div>
        </article>
      )) : (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
          No homework has been assigned yet.
        </div>
      )}
    </section>
  );
}
