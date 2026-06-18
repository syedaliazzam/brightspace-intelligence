"use client";

function ReportCard({ title, rows }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">{title}</p>
      <div className="mt-4 space-y-3">
        {rows?.length ? (
          rows.map((row) => (
            <div key={`${title}-${row.label}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-600">{row.label}</span>
              <span className="font-semibold text-slate-950">{row.total}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No report data available.</p>
        )}
      </div>
    </section>
  );
}

export default function CoordinatorReportsPanel({ data }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ReportCard title="Registration pipeline" rows={data.registrationPipeline} />
      <ReportCard title="Fee verification" rows={data.feeVerification} />
      <ReportCard title="Lecture completion" rows={data.lectureCompletion} />
      <ReportCard title="Teacher class report" rows={data.teacherClassReport} />
      <ReportCard title="Student activity" rows={data.studentActivity} />
    </div>
  );
}
