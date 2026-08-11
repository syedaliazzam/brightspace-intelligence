"use client";

export default function AttendanceSummary({ summary = {}, items = [] }) {
  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/18 bg-[linear-gradient(135deg,rgba(13,59,46,0.95)_0%,rgba(13,92,72,0.92)_100%)] p-5 text-[#FAF7F0] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.22)] backdrop-blur-xl">
      <p className="mt-3 text-4xl font-semibold text-[#FFF5D6]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
      <p className="mt-2 text-sm text-[#F1EADC]">
        {summary.total_conducted ? `Conducted lectures: ${summary.total_conducted}` : "No conducted lectures yet."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Attended</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.attended_classes || 0}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.absent_classes || 0}</p>
        </div>
        <div className="rounded-[1.5rem] border border-[#65B891]/25 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.06)_100%)] p-4 text-sm text-[#F1EADC]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E4C766]">Percentage</p>
          <p className="mt-2 text-2xl font-semibold text-[#FFF5D6]">{summary.total_conducted ? `${summary.attendance_percentage || 0}%` : "0%"}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#65B891]/22">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm text-[#F1EADC]">
            <thead className="bg-[rgba(255,255,255,0.08)] text-xs uppercase tracking-[0.16em] text-[#E4C766]">
              <tr>
                <th className="px-4 py-3 font-semibold">Lecture</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Teacher</th>
                <th className="px-4 py-3 font-semibold">Scheduled</th>
                <th className="px-4 py-3 font-semibold">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-white/10 bg-[rgba(255,255,255,0.04)] transition hover:bg-[rgba(255,255,255,0.07)]">
                    <td className="px-4 py-3 font-semibold text-[#FFF5D6]">{item.title || "-"}</td>
                    <td className="px-4 py-3">{item.subject_name || "-"}</td>
                    <td className="px-4 py-3">{item.teacher_name || "-"}</td>
                    <td className="px-4 py-3 text-xs text-[#E4C766]">{item.scheduled_start || "-"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#FFF5D6]">
                        {item.attendance_status || "absent"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-5 text-sm text-[#F1EADC]">
                    No attendance records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
