"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function HomeworkForm({ lectures = [], excludeLectureIds = [], initialValue = null, onSaved }) {
  const [form, setForm] = useState({ lectureId: "", title: "", description: "", dueDate: "" });
  const [pending, setPending] = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);

  const allowedLectures = useMemo(() => lectures.filter((item) => {
    const status = String(item.display_status || item.status || "").toLowerCase();
    return ["ended", "completed_by_teacher", "verified_by_coordinator"].includes(status)
      && !excludeLectureIds.includes(String(item.id || ""));
  }), [lectures, excludeLectureIds]);

  const uniqueAllowedLectures = Array.from(
    new Map(allowedLectures.map((item) => [String(item.id), item])).values()
  );

  function formatLectureLabel(item) {
    const dateLabel = item.scheduled_start ? new Date(item.scheduled_start).toLocaleDateString() : "";
    return `${item.title}${dateLabel ? ` - ${dateLabel}` : ""}${item.subject_name ? ` - ${item.subject_name}` : ""}`;
  }

  useEffect(() => {
    if (!initialValue) return;
    setForm({
      lectureId: initialValue.lecture_id || "",
      title: initialValue.title || "",
      description: initialValue.description || "",
      dueDate: initialValue.due_date ? String(initialValue.due_date).slice(0, 10) : "",
    });
  }, [initialValue]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/teacher/homework", {
        method: initialValue ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save homework.");
      setForm({ lectureId: "", title: "", description: "", dueDate: "" });
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save homework.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="relative">
          <select
            value={form.lectureId}
            onMouseDown={() => setLectureOpen((current) => !current)}
            onChange={(event) => {
              setLectureOpen(false);
              setForm((current) => ({ ...current, lectureId: event.target.value }));
            }}
            onFocus={() => setLectureOpen(true)}
            onBlur={() => setLectureOpen(false)}
            className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
            required
          >
            <option value="">Select lecture</option>
            {uniqueAllowedLectures.map((item) => <option key={item.id} value={item.id}>{formatLectureLabel(item)}</option>)}
          </select>
          <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${lectureOpen ? "rotate-180" : "rotate-0"}`} />
        </div>
        <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Homework title" className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" required />
        <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      </div>
      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-28 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      <div className="flex justify-end">
        <button disabled={pending} className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_10px_28px_-18px_rgba(13,59,46,0.45)]">{pending ? "Saving..." : initialValue ? "Update homework" : "Create homework"}</button>
      </div>
    </form>
  );
}
