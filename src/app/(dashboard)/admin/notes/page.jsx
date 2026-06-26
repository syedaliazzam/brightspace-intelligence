"use client";

import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";

export default function AdminNotesPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Notes</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Teacher notes across the portal</h1>
      </section>

      <NoteThreadsBoard mode="viewer" />
    </div>
  );
}
