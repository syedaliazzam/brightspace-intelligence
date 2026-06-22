"use client";

import { motion } from "framer-motion";
import { formatDateTimeRange } from "@/lib/dateTime";
import { getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function LectureScheduleTable({ items = [], onRefresh }) {
  const finalStatuses = new Set(["cancelled", "verified_by_coordinator", "completed_by_teacher"]);

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

  function promptReschedule(item) {
    const scheduledStart = window.prompt("New start (YYYY-MM-DDTHH:mm)", item.scheduled_start?.replace(" ", "T").slice(0, 16) || "");
    const scheduledEnd = window.prompt("New end (YYYY-MM-DDTHH:mm)", item.scheduled_end?.replace(" ", "T").slice(0, 16) || "");
    if (!scheduledStart || !scheduledEnd) return;
    const googleMeetLink = window.prompt("New Google Meet Link", item.google_meet_link || "") || "";
    if (!googleMeetLink.trim()) {
      window.alert("Google Meet link is required.");
      return;
    }
    if (!googleMeetLink.trim().startsWith("https://meet.google.com/")) {
      window.alert("Google Meet link must start with https://meet.google.com/.");
      return;
    }
    const notes = window.prompt("Optional reason / notes", item.description || "") || "";
    patchSchedule(item.id, { action: "reschedule", scheduledStart, scheduledEnd, googleMeetLink: googleMeetLink.trim(), description: notes }).catch((error) => window.alert(error.message));
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_180px] gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid lg:items-center">
        <span>Lecture</span>
        <span>Subject</span>
        <span>Schedule / Status</span>
        <span>Class / Meet</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => {
            const statusKey = String(item.status || "").toLowerCase();
            const isFinal = finalStatuses.has(statusKey);

            return (
              <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_180px] lg:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.student_count > 1 ? `${item.student_count} students` : item.student_names} with {item.teacher_name}
                  </p>
                </div>
                <p className="text-sm text-slate-600">{item.subject_name}</p>
                <div className="text-sm text-slate-600">
                  <p>{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.display_status || getLectureDisplayStatus(item)}</p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{item.course_title}</p>
                {item.meet_link_source ? <p className="mt-1 text-xs text-slate-500">Link source: {item.meet_link_source}</p> : null}
                {item.google_meet_link && !isFinal && !["ended", "completed", "verified", "missed", "cancelled", "rescheduled", "disputed"].includes(String(item.display_status || getLectureDisplayStatus(item)).toLowerCase()) ? (
                  <a href={item.google_meet_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-sky-700">
                    Open Meet link
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No active Meet link</p>
                )}
              </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button type="button" disabled={isFinal} onClick={() => patchSchedule(item.id, { action: "cancel" }).catch((error) => window.alert(error.message))} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isFinal}
                    onClick={() => promptReschedule(item)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reschedule
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No lecture schedules available.</div>
        )}
      </div>
    </motion.div>
  );
}
