"use client";

import { AnimatePresence, motion } from "framer-motion";
import AttendanceForm from "@/components/teacher/AttendanceForm";
import CompletionReportForm from "@/components/teacher/CompletionReportForm";
import { canShowJoinMeet, canShowMarkConducted, getLectureDisplayStatus } from "@/lib/lectureStatus";

export default function ClassActionModal({ lecture, open, onClose, onChanged }) {
  if (!open || !lecture?.id) {
    return null;
  }

  const canJoin = canShowJoinMeet(lecture);
  const displayStatus = getLectureDisplayStatus(lecture);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function markConducted() {
    const response = await fetch(`/api/teacher/lectures/${lecture.id}`, { method: "PATCH" });
    const data = await readJson(response);
    if (!response.ok) {
      window.alert(data?.message || "Unable to mark conducted.");
      return;
    }
    onChanged?.();
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Class actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{lecture.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{lecture.student_name} - {lecture.subject_name}</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Close</button>
          </div>
          <div className="mt-5 grid gap-5">
            {lecture.google_meet_link && canJoin ? (
              <a href={lecture.google_meet_link} target="_blank" rel="noreferrer" className="rounded-2xl bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white">
                Join Google Meet
              </a>
            ) : (
              <span className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-600">{displayStatus}</span>
            )}
            {canShowMarkConducted(lecture) ? (
              <button onClick={markConducted} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">Mark conducted</button>
            ) : null}
            <AttendanceForm lecture={lecture} onSaved={onChanged} />
            <CompletionReportForm lecture={lecture} onSaved={onChanged} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
