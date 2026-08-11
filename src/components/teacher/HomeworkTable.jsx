"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" });
}

function formatLectureLabel(item) {
  return item.lecture_title || item.title || "-";
}

function getAttachmentUrls(item) {
  if (Array.isArray(item?.homework_attachment_urls) && item.homework_attachment_urls.length) {
    return item.homework_attachment_urls;
  }
  return item?.homework_attachment_url ? [item.homework_attachment_url] : [];
}

function HomeworkDetailsModal({ item, onClose }) {
  if (!item) return null;

  const studentRows = Array.isArray(item.student_rows) ? item.student_rows : [];
  const submittedRows = studentRows.filter((row) => String(row.status || "").toLowerCase() === "submitted");
  const pendingRows = studentRows.filter((row) => String(row.status || "").toLowerCase() !== "submitted");
  const dueDateLabel = formatDate(item.due_date);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-[#063F32]/45 px-4 py-8 pt-24">
      <div className="flex max-h-[calc(100vh-7rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Homework details</p>
            <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">{item.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] hover:bg-[#F1EADC]">Close</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
              <p className="font-semibold text-[#063F32]">Homework info</p>
              <p className="mt-2"><strong>Class:</strong> {item.class_level || item.course_title || "-"}</p>
              <p className="mt-1"><strong>Subject:</strong> {item.subject_name || "-"}</p>
              <p className="mt-1"><strong>Teacher:</strong> {item.teacher_name || "-"}</p>
              <p className="mt-1"><strong>Due date:</strong> {dueDateLabel}</p>
              <p className="mt-1"><strong>Total students:</strong> {item.total_students_count || 0}</p>
              <p className="mt-1"><strong>Submitted:</strong> {submittedRows.length}</p>
              <p className="mt-1"><strong>Not submitted:</strong> {pendingRows.length}</p>
            </div>
            <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
              <p className="font-semibold text-[#063F32]">Description</p>
              <p className="mt-2 whitespace-pre-line">{item.description || "No description."}</p>
            </div>
          </div>

          {getAttachmentUrls(item).length ? (
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {getAttachmentUrls(item).map((url, index) => (
                <a
                  key={`${url}-${index}`}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-[180px] shrink-0 items-center justify-center rounded-[1.25rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] px-4 py-3 text-center text-sm font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC]"
                >
                  Open homework file {index + 1}
                </a>
              ))}
            </div>
          ) : null}

          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15">
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              <span>Student</span>
              <span>Username</span>
              <span>Status</span>
            </div>
            {studentRows.length ? studentRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 text-sm text-[#245C4F]">
                <span>{row.student_name || "-"}</span>
                <span>{row.student_username || "-"}</span>
                <span className={String(row.status || "").toLowerCase() === "submitted" ? "font-semibold text-[#2D8A6A]" : "text-[#245C4F]"}>{row.status || "pending"}</span>
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-[#245C4F]">No student rows available.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkTable({ items = [], onEdit }) {
  const [detailsItem, setDetailsItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const pageSize = 7;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [items]);

  const visibleItems = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
  }, [items, page]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  return (
    <>
      <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-[1600px] divide-y divide-[#F1EADC] text-left text-sm">
            <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
              <tr>
                <th className="w-[240px] px-6 py-4">Homework</th>
                <th className="w-[340px] px-6 py-4">Description</th>
                <th className="w-[240px] px-6 py-4">Document</th>
                <th className="w-[220px] px-6 py-4">Lecture</th>
                <th className="w-[180px] px-6 py-4">Class</th>
                <th className="w-[180px] px-6 py-4">Subject</th>
                <th className="w-[160px] px-6 py-4">Due Date</th>
                <th className="w-[120px] px-6 py-4">Submitted</th>
                <th className="w-[120px] px-6 py-4">Pending</th>
                <th className="w-[180px] px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {visibleItems.length ? visibleItems.map((item, index) => (
                <tr key={`${item.lecture_id}-${index}`}>
                  <td className="w-[240px] px-6 py-4">
                    <p className="font-semibold text-[#063F32]">{item.title}</p>
                  </td>
                  <td className="w-[340px] px-6 py-4 text-[#245C4F]">{item.description || "No description."}</td>
                  <td className="w-[240px] px-6 py-4 text-[#245C4F]">
                    {getAttachmentUrls(item).length ? (
                      <div className="flex flex-wrap gap-2">
                        {getAttachmentUrls(item).map((url, index) => (
                          <a
                            key={`${url}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                          >
                            View {index + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="w-[220px] px-6 py-4 text-[#245C4F]">{formatLectureLabel(item)}</td>
                  <td className="w-[180px] px-6 py-4 text-[#245C4F]">{item.class_level || item.course_title || "-"}</td>
                  <td className="w-[180px] px-6 py-4 text-[#245C4F]">{item.subject_name || "-"}</td>
                  <td className="w-[160px] px-6 py-4 text-[#245C4F]">{formatDate(item.due_date)}</td>
                  <td className="w-[120px] px-6 py-4 text-[#245C4F]">{item.submitted_count || 0}</td>
                  <td className="w-[120px] px-6 py-4 text-[#245C4F]">{item.pending_count || 0}</td>
                  <td className="w-[180px] px-6 py-4">
                    <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                      <button type="button" onClick={() => setDetailsItem(item)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">View details</button>
                      <button type="button" onClick={() => setEditItem(item)} className="rounded-xl bg-[#0D5C48] hover:bg-[#063F32] px-3 py-2 text-xs font-semibold text-[#FAF7F0]">Edit</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-[#245C4F]">No homework created yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {items.length > pageSize ? (
          <PaginationControls page={page} pageSize={pageSize} totalItems={items.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
        ) : null}
      </section>

      <HomeworkDetailsModal
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
      />

      {editItem ? (
        <EditHomeworkModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={(nextItem) => {
            setEditItem(null);
            onEdit?.(nextItem || editItem);
          }}
        />
      ) : null}
    </>
  );
}

function EditHomeworkModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState({
    lectureId: item.lecture_id || "",
    title: item.title || "",
    description: item.description || "",
    dueDate: item.due_date ? String(item.due_date).slice(0, 10) : "",
    files: [],
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm({
      lectureId: item.lecture_id || "",
      title: item.title || "",
      description: item.description || "",
      dueDate: item.due_date ? String(item.due_date).slice(0, 10) : "",
      files: [],
    });
  }, [item]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const payload = new FormData();
      payload.append("lectureId", item.lecture_id);
      payload.append("title", form.title);
      payload.append("description", form.description);
      payload.append("dueDate", form.dueDate);
      form.files.forEach((file) => payload.append("file", file));
      const response = await fetch("/api/teacher/homework", {
        method: "PATCH",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to save homework.");
      onSaved?.(item);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to save homework.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-[#063F32]/45 px-4 py-8 pt-24">
      <div className="flex max-h-[calc(100vh-7rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Edit homework</p>
            <h3 className="mt-2 font-body text-2xl font-semibold tracking-tight text-[#063F32]">{item.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] hover:bg-[#F1EADC]">
            Close
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#063F32]">Homework title</span>
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Homework title" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" required />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#063F32]">Due date</span>
              <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-medium text-[#063F32]">Description</span>
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="min-h-28 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20" />
          </label>
          {getAttachmentUrls(item).length ? (
            <div className="mt-3 grid gap-3">
              {getAttachmentUrls(item).map((url, index) => (
                <div key={`${url}-${index}`} className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0]">
                  <a href={url} target="_blank" rel="noreferrer" className="block px-4 py-4 text-sm font-semibold text-[#0D5C48]">
                    Current homework file {index + 1}
                  </a>
                </div>
              ))}
            </div>
          ) : null}
          <label className="mt-3 block">
            <span className="mb-2 block text-sm font-medium text-[#063F32]">Upload document</span>
            <input
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files || []).filter((file) => file.size > 0);
                setForm((current) => ({ ...current, files: selectedFiles }));
              }}
              className="block w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={pending} className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0]">
              {pending ? "Saving..." : "Update homework"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
