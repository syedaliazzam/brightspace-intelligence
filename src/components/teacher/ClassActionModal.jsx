"use client";

import { AnimatePresence, motion } from "framer-motion";
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
    onClose?.();
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 pt-24 pb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="max-h-[calc(100vh-7rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Class actions</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{lecture.title}</h2>
              <p className="mt-1 text-sm text-[#245C4F]">{lecture.student_name} - {lecture.subject_name}</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32]">Close</button>
          </div>
          <div className="mt-5 grid gap-5">
            {lecture.google_meet_link && canJoin ? (
              <a href={lecture.google_meet_link} target="_blank" rel="noreferrer" className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-center text-sm font-semibold text-[#FAF7F0]">
                Join Google Meet
              </a>
            ) : (
              <span className="rounded-2xl bg-[#FAF7F0] px-4 py-3 text-center text-sm font-semibold text-[#245C4F]">{displayStatus}</span>
            )}
            {canShowMarkConducted(lecture) ? (
              <button onClick={markConducted} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32]">Mark conducted</button>
            ) : null}
            <CompletionReportForm
              lecture={lecture}
              onSaved={async () => {
                await onChanged?.();
                onClose?.();
              }}
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
