"use client";

import { useState } from "react";

export default function TeacherNotesPanel({ lectures = [], items = [], onSaved }) {
  const [form, setForm] = useState({ lectureId: "", visibility: "parent", note: "" });

  async function submit(event) {
    event.preventDefault();
    const response = await fetch("/api/teacher/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    if (!response.ok) return window.alert(data?.message || "Unable to add note.");
    setForm({ lectureId: "", visibility: "parent", note: "" });
    onSaved?.();
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={submit} className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
          Parent and Student notes appear in the timeline page. Admin only notes stay internal for staff.
        </div>
        <select value={form.lectureId} onChange={(event) => setForm((current) => ({ ...current, lectureId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required><option value="">Select lecture</option>{lectures.map((item) => <option key={item.id} value={item.id}>{item.title} - {item.student_name}</option>)}</select>
        <select value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"><option value="parent">Parent</option><option value="student">Student</option><option value="admin_only">Admin only</option></select>
        <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} placeholder="Teacher note" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
        <button className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">Add note</button>
      </form>
      <section className="grid gap-3">
        {items.length ? items.map((item, index) => <article key={`${item.id}-${index}`} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5"><p className="text-sm font-semibold text-sky-700">{item.student_name} - {item.visibility === "parent" ? "Visible to parent timeline" : item.visibility === "student" ? "Student-facing note" : "Admin only"}</p><p className="mt-2 text-slate-700">{item.note}</p></article>) : <p className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-sm text-slate-600">No notes yet.</p>}
      </section>
    </div>
  );
}
