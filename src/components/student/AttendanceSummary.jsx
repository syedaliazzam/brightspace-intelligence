"use client";

export default function AttendanceSummary({ summary = {}, items = [] }) {
  return (
    <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <p className="mt-3 text-4xl font-semibold text-[#063F32]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
      <p className="mt-2 text-sm text-[#245C4F]">
        {summary.total_conducted ? `Conducted lectures: ${summary.total_conducted}` : "No conducted lectures yet."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Attended</p>
          <p className="mt-2 text-2xl font-semibold text-[#063F32]">{summary.attended_classes || 0}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-[#063F32]">{summary.absent_classes || 0}</p>
        </div>
        <div className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Percentage</p>
          <p className="mt-2 text-2xl font-semibold text-[#063F32]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
            <p className="font-semibold text-[#063F32]">{item.title}</p>
            <p className="mt-1">{item.subject_name} · {item.teacher_name}</p>
            <p className="mt-1 text-xs text-[#0D5C48]">{item.scheduled_start}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#0D5C48]">{item.attendance_status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
