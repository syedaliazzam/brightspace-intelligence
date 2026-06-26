"use client";

import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";

export default function TeacherNotesPanel({ lectures = [] }) {
  return <NoteThreadsBoard mode="teacher" lectures={lectures} title="Teacher notes" subtitle="Student observations" />;
}
