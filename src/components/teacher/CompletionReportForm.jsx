"use client";

import { useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function CompletionReportForm({ lecture, onSaved }) {
  const [form, setForm] = useState({ topicCovered: "", summary: "", homeworkGiven: "", studentPerformance: "" });
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!lecture?.id) {
      window.alert("Please select a class first.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/teacher/lectures/${lecture.id}/completion-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to submit report.");
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to submit report.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <input value={form.topicCovered} onChange={(event) => setForm((current) => ({ ...current, topicCovered: event.target.value }))} placeholder="Topic covered" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <textarea value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="Class summary" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <input value={form.homeworkGiven} onChange={(event) => setForm((current) => ({ ...current, homeworkGiven: event.target.value }))} placeholder="Homework given" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <textarea value={form.studentPerformance} onChange={(event) => setForm((current) => ({ ...current, studentPerformance: event.target.value }))} placeholder="Student performance note" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <button disabled={pending} className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0]">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <LeafSpinnerInline />
            Saving...
          </span>
        ) : (
          "Submit completion report"
        )}
      </button>
    </form>
  );
}
