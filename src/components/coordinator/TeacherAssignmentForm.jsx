"use client";

import { useState } from "react";

export default function TeacherAssignmentForm({ options, onSuccess }) {
  const [form, setForm] = useState({
    teacherId: "",
    studentId: "",
    courseId: "",
    subjectId: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/coordinator/teacher-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to assign teacher.");
      }

      setForm({ teacherId: "", studentId: "", courseId: "", subjectId: "" });
      onSuccess?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to assign teacher.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:grid-cols-4">
      <select value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select teacher</option>
        {options.teachers?.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
      </select>
      <select value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select student</option>
        {options.students?.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
      </select>
      <select value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select course</option>
        {options.courses?.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>
      <div className="flex gap-3">
        <select value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <option value="">Select subject</option>
          {options.subjects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="submit" disabled={submitting} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
          {submitting ? "Saving..." : "Assign"}
        </button>
      </div>
    </form>
  );
}

