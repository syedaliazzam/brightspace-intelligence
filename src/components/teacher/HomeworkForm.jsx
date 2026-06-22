"use client";

import { useState } from "react";

export default function HomeworkForm({ lectures = [], onSaved }) {
  const [form, setForm] = useState({ lectureId: "", title: "", description: "", dueDate: "" });
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/teacher/homework", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create homework.");
      setForm({ lectureId: "", title: "", description: "", dueDate: "" });
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to create homework.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] md:grid-cols-2">
      <select value={form.lectureId} onChange={(event) => setForm((current) => ({ ...current, lectureId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required><option value="">Select lecture</option>{lectures.map((item) => <option key={item.id} value={item.id}>{item.title} - {item.student_name}</option>)}</select>
      <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Homework title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
      <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <button disabled={pending} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">{pending ? "Saving..." : "Create homework"}</button>
      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm md:col-span-2" />
    </form>
  );
}
