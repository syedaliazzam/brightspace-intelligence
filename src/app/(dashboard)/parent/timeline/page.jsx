"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import ClassTimeline from "@/components/parent/ClassTimeline";
import HomeworkList from "@/components/parent/HomeworkList";
import TeacherNotesList from "@/components/parent/TeacherNotesList";

export default function ParentTimelinePage() {
  const [state, setState] = useState({ children: [], selectedChildId: "", items: [], notes: [], homeworks: [], error: "" });

  async function load(childId = state.selectedChildId) {
    const query = childId ? `?childId=${encodeURIComponent(childId)}` : "";
    const [childrenResponse, timelineResponse] = await Promise.all([
      fetch("/api/parent/children", { cache: "no-store" }),
      fetch(`/api/parent/timeline${query}`, { cache: "no-store" }),
    ]);
    const childrenData = await childrenResponse.json();
    const timelineData = await timelineResponse.json();
    if (!childrenResponse.ok || !timelineResponse.ok) throw new Error(childrenData?.message || timelineData?.message || "Unable to load timeline.");
    setState({ children: childrenData.children || [], selectedChildId: childId || childrenData.children?.[0]?.id || "", items: timelineData.items || [], notes: timelineData.notes || [], homeworks: timelineData.homeworks || [], error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="relative rounded-[2rem] min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Parent timeline</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#063F32] sm:text-4xl">Learning activity and teacher notes</h1>
      </section>
      <ChildSwitcher childrenList={state.children} value={state.selectedChildId} onChange={(id) => load(id).catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <ClassTimeline items={state.items} />
      <HomeworkList items={state.homeworks} />
      <TeacherNotesList items={state.notes} />
      </div>
    </div>
  );
}
