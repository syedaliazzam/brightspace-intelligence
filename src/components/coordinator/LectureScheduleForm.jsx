"use client";

import { useMemo, useState } from "react";

export default function LectureScheduleForm({ options, onSuccess }) {
  const [form, setForm] = useState({
    enrollmentId: "",
    studentId: "",
    teacherId: "",
    subjectId: "",
    title: "",
    description: "",
    scheduledStart: "",
    scheduledEnd: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const enrollmentOptions = useMemo(
    () =>
      (options.enrollments || []).filter(
        (item) => !form.studentId || item.student_id === form.studentId
      ),
    [options.enrollments, form.studentId]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/coordinator/lecture-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to schedule lecture.");
      }

      setForm({
        enrollmentId: "",
        studentId: "",
        teacherId: "",
        subjectId: "",
        title: "",
        description: "",
        scheduledStart: "",
        scheduledEnd: "",
      });
      onSuccess?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to schedule lecture.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:grid-cols-2">
      <select value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value, enrollmentId: "" }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select student</option>
        {options.students?.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
      </select>
      <select value={form.enrollmentId} onChange={(event) => setForm((current) => ({ ...current, enrollmentId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select enrollment</option>
        {enrollmentOptions.map((item) => <option key={item.id} value={item.id}>{item.student_name} - {item.course_title}</option>)}
      </select>
      <select value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select subject</option>
        {options.subjects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select value={form.teacherId} onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select teacher</option>
        {options.teachers?.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
      </select>
      <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Lecture title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <input type="datetime-local" value={form.scheduledStart} onChange={(event) => setForm((current) => ({ ...current, scheduledStart: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Coordinator notes or agenda" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <div className="flex gap-3">
        <input type="datetime-local" value={form.scheduledEnd} onChange={(event) => setForm((current) => ({ ...current, scheduledEnd: event.target.value }))} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
        <button type="submit" disabled={submitting} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
          {submitting ? "Saving..." : "Schedule"}
        </button>
      </div>
    </form>
  );
}

