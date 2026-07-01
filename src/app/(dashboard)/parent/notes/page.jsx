"use client";

import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";

export default function ParentNotesPage() {
  return (
    <div className="relative rounded-[2rem] min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Parent notes</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#063F32] sm:text-4xl">Teacher feedback and updates</h1>
      </section>

      <NoteThreadsBoard mode="parent" />
      </div>
    </div>
  );
}
