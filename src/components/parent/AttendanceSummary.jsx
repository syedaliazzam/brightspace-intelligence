"use client";

export default function AttendanceSummary({ summary = {}, items = [] }) {
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
        {items.length ? items.map((item, index) => (
          <div key={`${item.id || "attendance"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-950">{item.class_title || "Class attendance"}</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{item.status}</span>
            </div>
            <p className="mt-1 text-slate-600">{item.subject_name || "Subject not set"} - {item.duration_minutes || 0} minutes</p>
          </div>
        )) : <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No attendance records yet.</p>}
      </div>
    </section>
  );
}
