"use client";

import { formatDateTime } from "@/lib/dateTime";

export default function HomeworkList({ items = [] }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-3 py-3">Homework</th>
              <th className="px-3 py-3">Lecture</th>
              <th className="px-3 py-3">Subject</th>
              <th className="px-3 py-3">Teacher</th>
              <th className="px-3 py-3">Student</th>
              <th className="px-3 py-3">Submitted Text</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? items.map((item, index) => {
              const submitted = String(item.status || "").toLowerCase() === "submitted";
              return (
                <tr key={`${item.id || "homework"}-${index}`}>
                  <td className="px-3 py-4">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description || "No description provided."}</p>
                  </td>
                  <td className="px-3 py-4 text-slate-600">{item.class_title || item.lecture_title || "-"}</td>
                  <td className="px-3 py-4 text-slate-600">{item.subject_name || "-"}</td>
                  <td className="px-3 py-4 text-slate-600">{item.teacher_name || "-"}</td>
                  <td className="px-3 py-4 text-slate-600">
                    {submitted ? item.student_name || "Submitted" : "Not submitted yet"}
                  </td>
                  <td className="px-3 py-4 text-slate-600">{submitted ? item.submission_note || "No text submitted." : "-"}</td>
                  <td className="px-3 py-4 text-slate-600">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                      submitted ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {item.status || "pending"}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-slate-600">{formatDateTime(item.due_date)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                  No homework has been assigned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
