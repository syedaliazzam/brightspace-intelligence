"use client";

export default function AssignedStudentsTable({ items = [] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Class</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? items.map((item, index) => (
              <tr key={`${item.id}-${index}`}><td className="px-3 py-4 font-semibold text-slate-950">{item.full_name}</td><td className="px-3 py-4 text-slate-600">{item.grade_level || "-"}</td><td className="px-3 py-4 text-slate-600">{item.subject_name || "-"}</td><td className="px-3 py-4 text-slate-600">{item.status}</td></tr>
            )) : <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No assigned students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
