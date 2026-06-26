"use client";

export default function AttendanceSummary({ summary = {}, items = [] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <p className="mt-3 text-4xl font-semibold text-slate-950">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
      <p className="mt-2 text-sm text-slate-600">
        {summary.total_conducted ? `Conducted lectures: ${summary.total_conducted}` : "No conducted lectures yet."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Attended</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.attended_classes || 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.absent_classes || 0}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Percentage</p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-950">{item.title}</p>
            <p className="mt-1">{item.subject_name} · {item.teacher_name}</p>
            <p className="mt-1 text-xs text-slate-500">{item.scheduled_start}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {item.attendance_status}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
