"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

export default function HomeworkForm({ lectures = [], excludeLectureIds = [], initialValue = null, onSaved }) {
  const [form, setForm] = useState({ lectureId: "", title: "", description: "", dueDate: "", files: [] });
  const [pending, setPending] = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);
  const [filePreviews, setFilePreviews] = useState([]);
  const [fileInputKey, setFileInputKey] = useState(0);

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
      setForm({ lectureId: "", title: "", description: "", dueDate: "", files: [] });
      setFilePreviews([]);
      setFileInputKey((current) => current + 1);
      return;
    }
    setForm({
      lectureId: initialValue.lecture_id || "",
      title: initialValue.title || "",
      description: initialValue.description || "",
      dueDate: initialValue.due_date ? String(initialValue.due_date).slice(0, 10) : "",
      files: [],
    });
    setFilePreviews(
      Array.isArray(initialValue.homework_attachment_urls) && initialValue.homework_attachment_urls.length
        ? initialValue.homework_attachment_urls.map((url) => ({
            url,
            name: String(url || "").split("/").pop() || "homework",
            type: String(url || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : "",
            isExisting: true,
          }))
        : (initialValue.homework_attachment_url
          ? [{
              url: initialValue.homework_attachment_url,
              name: initialValue.homework_attachment_name || "homework",
              type: String(initialValue.homework_attachment_url || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : "",
              isExisting: true,
            }]
          : [])
    );
  }, [initialValue]);

  useEffect(() => {
    return () => {
      filePreviews.forEach((preview) => {
        if (String(preview || "").startsWith("blob:")) URL.revokeObjectURL(preview);
      });
    };
  }, [filePreviews]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = new FormData();
      payload.append("lectureId", form.lectureId);
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("dueDate", form.dueDate);
      form.files.forEach((file) => payload.append("file", file));
      const response = await fetch("/api/teacher/homework", {
        method: initialValue ? "PATCH" : "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save homework.");
      setForm({ lectureId: "", title: "", description: "", dueDate: "", files: [] });
      setFilePreviews([]);
      setFileInputKey((current) => current + 1);
      onSaved?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save homework.");
    } finally {
      setPending(false);
    }
  }

  function removePreview(indexToRemove) {
    setFilePreviews((current) => {
      const target = current[indexToRemove];
      if (target?.url && String(target.url).startsWith("blob:")) {
        URL.revokeObjectURL(target.url);
      }
      return current.filter((_, index) => index !== indexToRemove);
    });
    setForm((current) => ({
      ...current,
      files: current.files.filter((_, index) => index !== indexToRemove),
    }));
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
            key={fileInputKey}
            type="file"
            multiple
            accept="image/*,.pdf"
            onChange={(event) => {
              const selectedFiles = Array.from(event.target.files || []).filter((file) => file.size > 0);
              const nextPreviews = selectedFiles.map((file) => ({
                url: URL.createObjectURL(file),
                name: file.name || "homework",
                type: file.type || "",
                isExisting: false,
              }));
              setForm((current) => ({ ...current, files: [...(current.files || []), ...selectedFiles] }));
              setFilePreviews((current) => [...current, ...nextPreviews]);
              event.target.value = "";
              setFileInputKey((current) => current + 1);
            }}
            className="block w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
          />
        </label>
      {filePreviews.length ? (
        <div className="overflow-hidden rounded-2xl border border-[#2D8A6A]/12 bg-[#FAF7F0] p-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {filePreviews.map((preview, index) => {
              const isPdf = String(preview.type || preview.url || "").toLowerCase().includes("pdf") || String(preview.name || "").toLowerCase().endsWith(".pdf") || String(preview.url || "").toLowerCase().endsWith(".pdf");
              return (
                <div
                  key={`${preview.url}-${index}`}
                  className="relative flex w-44 min-w-44 flex-col overflow-hidden rounded-xl border border-[#2D8A6A]/10 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => removePreview(index)}
                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#c70a0a] text-sm font-semibold text-[#FAF7F0] shadow-md transition hover:bg-[#c70a0a] cursor-pointer"
                    aria-label={`Remove file ${index + 1}`}
                  >
                    ×
                  </button>
                  <a href={preview.url} target="_blank" rel="noreferrer" className="block">
                    <div className="flex h-28 items-center justify-center overflow-hidden bg-[#FAF7F0]">
                      {isPdf ? (
                        <iframe
                          src={preview.url}
                          title={`Homework attachment PDF preview ${index + 1}`}
                          className="h-full w-full"
                        />
                      ) : (
                        <img src={preview.url} alt={`Homework attachment preview ${index + 1}`} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="border-t border-[#2D8A6A]/10 px-3 py-2 text-xs font-semibold text-[#0D5C48]">
                      {isPdf ? `Open PDF preview${preview.name ? ` · ${preview.name}` : ""}` : "Open image preview"}
                    </div>
                  </a>
                </div>
              );
            })}
          </div>
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
