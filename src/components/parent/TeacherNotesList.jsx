"use client";

export default function TeacherNotesList({ items = [] }) {
  return (
    <section className="grid gap-4">
      {items.length ? items.map((item, index) => (
        <article key={`${item.id || "note"}-${index}`} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_16px_55px_-34px_rgba(15,23,42,0.24)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">{item.teacher_name ? `Teacher: ${item.teacher_name}` : "Teacher note"}</p>
          <p className="mt-3 leading-7 text-slate-700">{item.note}</p>
        </article>
      )) : (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">
          No teacher notes are available yet.
        </div>
      )}
    </section>
  );
}
