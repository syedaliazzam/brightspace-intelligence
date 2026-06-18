"use client";

import { motion } from "framer-motion";

export default function LectureScheduleTable({ items = [], onRefresh }) {
  async function patchSchedule(id, payload) {
    const response = await fetch(`/api/coordinator/lecture-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update lecture schedule.");
    }

    onRefresh?.();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-center">
              <div>
                <p className="font-semibold text-slate-950">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.student_name} with {item.teacher_name}</p>
              </div>
              <p className="text-sm text-slate-600">{item.subject_name}</p>
              <div className="text-sm text-slate-600">
                <p>{new Date(item.scheduled_start).toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
              <div className="text-sm text-slate-600">
                <p>{item.course_title}</p>
                <p className="mt-1 text-xs text-sky-700">{item.google_meet_link ? "Meet ready" : "Meet pending"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => patchSchedule(item.id, { action: "cancel" }).catch((error) => window.alert(error.message))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const scheduledStart = window.prompt("New start (YYYY-MM-DDTHH:mm)", item.scheduled_start?.slice(0, 16) || "");
                    const scheduledEnd = window.prompt("New end (YYYY-MM-DDTHH:mm)", item.scheduled_end?.slice(0, 16) || "");
                    if (!scheduledStart || !scheduledEnd) return;
                    patchSchedule(item.id, { action: "reschedule", scheduledStart, scheduledEnd }).catch((error) => window.alert(error.message));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Reschedule
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No lecture schedules available.</div>
        )}
      </div>
    </motion.div>
  );
}

