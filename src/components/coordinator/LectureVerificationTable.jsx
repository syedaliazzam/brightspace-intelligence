"use client";

import { motion } from "framer-motion";
import { formatDateTime, formatDateTimeRange } from "@/lib/dateTime";
import { getAttendanceStatus, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function LectureVerificationTable({ items = [], onRefresh }) {
  async function syncMeetAttendance(id) {
    const response = await fetch(`/api/coordinator/lecture-schedules/${id}/meet-attendance-sync`, {
      method: "POST",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to sync Meet attendance.");
    }

    if (data.available === false) {
      window.alert(data.message || "Meet attendance may be available only after Google finishes processing the conference record.");
    }

    onRefresh?.();
  }

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
                  Class roster: {item.course_title || item.class_level || "Class"} · {item.subject_name} · {item.teacher_name}
                </p>
                <p className="mt-1 text-sm text-slate-500">{formatDateTimeRange(item.scheduled_start, item.scheduled_end)}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">{item.display_status || getLectureDisplayStatus(item)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => syncMeetAttendance(item.id).catch((error) => window.alert(error.message))} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">
                  Sync Meet Attendance
                </button>
                {['completed_by_teacher', 'live', 'scheduled', 'upcoming'].includes(String(item.display_status || item.status || '').toLowerCase()) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const manualConfirm = !item.summary && !item.topic_covered
                          ? window.confirm("Teacher completion report is missing. Approve manually?")
                          : false;
                        if (!item.summary && !item.topic_covered && !manualConfirm) return;
                        updateVerification(item.id, { action: "approve", manualConfirm }).catch((error) => window.alert(error.message));
                      }}
                      className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
                    >
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
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Teacher report</p>
                <p className="mt-2">{item.summary || item.topic_covered || "No teacher summary submitted."}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Teacher attendance</p>
                <p className="mt-2">Joined: {item.teacher_joined ? "Yes" : "No"}</p>
                <p className="mt-1 text-xs text-slate-500">Status: {item.teacher_attendance_status}</p>
                <p className="mt-1 text-xs text-slate-500">Joined at: {item.teacher_joined_at ? formatDateTime(item.teacher_joined_at) : "-"}</p>
                <p className="mt-1 text-xs text-slate-500">Left at: {item.teacher_left_at ? formatDateTime(item.teacher_left_at) : "-"}</p>
                <p className="mt-1 text-xs text-slate-500">{item.teacher_duration_minutes || 0} minutes</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Student attendance</p>
                <p className="mt-2">Class roster: {item.total_students_count || 0}</p>
                <p className="mt-1 text-xs text-slate-500">Present count: {item.joined_students_count || 0}</p>
                <p className="mt-1 text-xs text-slate-500">Absent count: {item.absent_students_count ?? 0}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Remarks</p>
                <p className="mt-2">{item.remarks || item.student_performance || "No remarks yet."}</p>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span>Student Name</span>
                <span>Username / Phone</span>
                <span>Status</span>
              </div>
              {Array.isArray(item.attendance_rows) && item.attendance_rows.length ? (
                item.attendance_rows.map((row) => (
                  <div key={row.id || row.user_id} className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 text-sm text-slate-600">
                    <span>{row.student_name}</span>
                    <span>{row.username || row.student_phone || row.student_email || "-"}</span>
                    <span>{row.status || getAttendanceStatus(row.duration_minutes)}</span>
                  </div>
                ))
              ) : (
                <div className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 text-sm text-slate-600">
                  <span>{item.course_title || item.class_level || "Class roster"}</span>
                  <span>{item.total_students_count || 0} students</span>
                  <span>{item.student_attendance_status || getAttendanceStatus(item.student_duration_minutes)}</span>
                </div>
              )}
            </div>
            <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
              Meet attendance may be available only after Google finishes processing the conference record.
            </p>
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
