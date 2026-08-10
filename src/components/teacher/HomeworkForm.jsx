"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function HomeworkForm({ lectures = [], excludeLectureIds = [], initialValue = null, onSaved }) {
  const [form, setForm] = useState({ lectureId: "", title: "", description: "", dueDate: "", file: null });
  const [pending, setPending] = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);
  const [filePreview, setFilePreview] = useState("");

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
    if (!initialValue) {
      setForm({ lectureId: "", title: "", description: "", dueDate: "", file: null });
      setFilePreview("");
      return;
    }
    setForm({
      lectureId: initialValue.lecture_id || "",
      title: initialValue.title || "",
      description: initialValue.description || "",
      dueDate: initialValue.due_date ? String(initialValue.due_date).slice(0, 10) : "",
      file: null,
    });
    setFilePreview(initialValue.homework_attachment_url || "");
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = new FormData();
      payload.append("lectureId", form.lectureId);
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("dueDate", form.dueDate);
      if (form.file) payload.append("file", form.file);
      const response = await fetch("/api/teacher/homework", {
        method: initialValue ? "PATCH" : "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save homework.");
      setForm({ lectureId: "", title: "", description: "", dueDate: "", file: null });
      setFilePreview("");
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save homework.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#063F32]">Lecture</span>
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
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#063F32]">Homework title</span>
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Homework title" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" required />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-[#063F32]">Due date</span>
          <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
        </label>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#063F32]">Description</span>
        <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-28 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-[#063F32]">Upload document</span>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => {
            const selected = event.target.files?.[0] || null;
            setForm((current) => ({ ...current, file: selected }));
            if (filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview);
            setFilePreview(selected ? URL.createObjectURL(selected) : initialValue?.homework_attachment_url || "");
          }}
          className="block w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
        />
      </label>
      {filePreview ? (
        <div className="overflow-hidden rounded-2xl border border-[#2D8A6A]/12 bg-[#FAF7F0]">
          {String(form.file?.type || "").includes("pdf") || String(filePreview).toLowerCase().endsWith(".pdf") ? (
            <a href={filePreview} target="_blank" rel="noreferrer" className="block px-4 py-6 text-sm font-semibold text-[#0D5C48]">Open uploaded PDF</a>
          ) : (
            <a href={filePreview} target="_blank" rel="noreferrer" className="block">
              <img src={filePreview} alt="Homework attachment preview" className="max-h-56 w-full object-contain" />
            </a>
          )}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button disabled={pending} className="rounded-2xl bg-[#0D5C48] hover:bg-[#063F32] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_10px_28px_-18px_rgba(13,59,46,0.45)]">
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <LeafSpinnerInline />
              Saving...
            </span>
          ) : initialValue ? "Update homework" : "Create homework"}
        </button>
      </div>
    </form>
  );
}
