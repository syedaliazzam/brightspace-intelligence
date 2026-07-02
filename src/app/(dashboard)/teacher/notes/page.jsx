"use client";

import { useEffect, useState } from "react";
import TeacherNotesPanel from "@/components/teacher/TeacherNotesPanel";

export default function TeacherNotesPage() {
  const [state, setState] = useState({ classes: [], notes: [], error: "" });

  async function load() {
    const [classesResponse, notesResponse] = await Promise.all([
      fetch("/api/teacher/lectures", { cache: "no-store" }),
      fetch("/api/teacher/notes", { cache: "no-store" }),
    ]);
    const classesData = await classesResponse.json();
    const notesData = await notesResponse.json();
    if (!classesResponse.ok || !notesResponse.ok) throw new Error(classesData?.message || notesData?.message || "Unable to load notes.");
    setState({ classes: classesData.items || [], notes: notesData.items || [], error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="min-h-screen rounded-[2rem] border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none rounded-[2rem] border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#E4C766]">Teacher notes</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Student observations</h1>
        </section>
        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        <TeacherNotesPanel lectures={state.classes} items={state.notes} onSaved={() => load()} />
      </div>
    </div>
  );
}
