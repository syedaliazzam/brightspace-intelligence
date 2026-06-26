"use client";

import { useEffect, useState } from "react";
import HomeworkApprovalTable from "@/components/teacher/HomeworkApprovalTable";

export default function TeacherHomeworkApprovalPage() {
  const [state, setState] = useState({ items: [], error: "" });

  async function load() {
    const response = await fetch("/api/teacher/homework/submissions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load homework submissions.");
    setState((current) => ({ ...current, items: data.items || [], error: "" }));
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Approve homework</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Review submitted homework</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">Approve or reject student submissions. Rejected homework moves back to pending so the student can resubmit.</p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

      <HomeworkApprovalTable
        items={state.items}
        onRefresh={() => load().catch((error) => setState((current) => ({ ...current, error: error.message })))}
      />
    </div>
  );
}
