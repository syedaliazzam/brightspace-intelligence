"use client";

export default function TeacherNotesList({ items = [] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            {item.source_role || "Teacher"} note
            {item.visibility ? ` · Visible to ${String(item.visibility).replaceAll("_", " ")}` : ""}
          </p>
          <p className="mt-2 leading-6 text-slate-700">{item.note}</p>
          {item.teacher_name ? <p className="mt-2 text-xs font-medium text-slate-500">From {item.teacher_name}</p> : null}
        </article>
      ))}
      {!items.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">No teacher notes available.</p> : null}
    </div>
  );
}
