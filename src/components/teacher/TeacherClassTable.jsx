"use client";

import { formatDateTimeRange } from "@/lib/dateTime";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function TeacherClassTable({ items = [], onOpen }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr><th className="px-3 py-3">Class</th><th className="px-3 py-3">Student</th><th className="px-3 py-3">Subject</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Meet</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-4 font-semibold text-slate-950">{item.title}</td>
                <td className="px-3 py-4 text-slate-600">{item.student_name}</td>
                <td className="px-3 py-4 text-slate-600">{item.subject_name}</td>
                <td className="px-3 py-4 text-slate-600">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</td>
                <td className="px-3 py-4 text-slate-600">
                  {canShowJoinMeet(item) ? <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="font-semibold text-sky-700">Open</a> : "-"}
                </td>
                <td className="px-3 py-4 text-slate-600">{item.display_status || getLectureDisplayStatus(item)}</td>
                <td className="px-3 py-4"><button onClick={() => onOpen?.(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">Open</button></td>
              </tr>
            )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No lectures found.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
