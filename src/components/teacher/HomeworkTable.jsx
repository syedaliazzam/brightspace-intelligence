"use client";

export default function HomeworkTable({ items = [] }) {
  return (
    <section className="grid gap-3">
      {items.length ? items.map((item, index) => (
        <article key={`${item.id}-${index}`} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_55px_-34px_rgba(15,23,42,0.24)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">{item.student_name} - {item.subject_name}</p>
              <p className="mt-2 text-sm text-slate-500">{item.description || "No description."}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Student submission</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{item.status === "submitted" ? "Submitted by student" : "Pending submission"}</p>
            </div>
          </div>
        </article>
      )) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">No homework created yet.</p>}
    </section>
  );
}
