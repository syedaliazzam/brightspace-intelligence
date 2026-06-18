"use client";

import { motion } from "framer-motion";

export default function LectureVerificationTable({ items = [], onRefresh }) {
  async function updateVerification(id, payload) {
    const response = await fetch(`/api/coordinator/lecture-verifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update lecture verification.");
    }

    onRefresh?.();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {items.length ? (
        items.map((item) => (
          <article key={item.id} className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-lg font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.student_name} with {item.teacher_name} · {item.subject_name}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                  {item.status}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => updateVerification(item.id, { action: "approve" }).catch((error) => window.alert(error.message))} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const remarks = window.prompt("Rejection reason", item.remarks || "");
                    if (remarks === null) return;
                    updateVerification(item.id, { action: "reject", remarks }).catch((error) => window.alert(error.message));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Reject
                </button>
                <button type="button" onClick={() => updateVerification(item.id, { action: "mark_missed" }).catch((error) => window.alert(error.message))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Mark missed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const scheduledStart = window.prompt("New start (YYYY-MM-DDTHH:mm)");
                    const scheduledEnd = window.prompt("New end (YYYY-MM-DDTHH:mm)");
                    if (!scheduledStart || !scheduledEnd) return;
                    updateVerification(item.id, { action: "reschedule", scheduledStart, scheduledEnd }).catch((error) => window.alert(error.message));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Reschedule
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Teacher report</p>
                <p className="mt-2">{item.summary || item.topic_covered || "No teacher summary submitted."}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Teacher attendance</p>
                <p className="mt-2">{item.teacher_attendance_status}</p>
                <p className="mt-1 text-xs text-slate-500">{item.teacher_duration_minutes || 0} minutes</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Student attendance</p>
                <p className="mt-2">{item.student_attendance_status}</p>
                <p className="mt-1 text-xs text-slate-500">{item.student_duration_minutes || 0} minutes</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Remarks</p>
                <p className="mt-2">{item.remarks || item.student_performance || "No remarks yet."}</p>
              </div>
            </div>
          </article>
        ))
      ) : (
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 px-5 py-10 text-sm text-slate-500 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          No lecture verification records available.
        </div>
      )}
    </motion.div>
  );
}

