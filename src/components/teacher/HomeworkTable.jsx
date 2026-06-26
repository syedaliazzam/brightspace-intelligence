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

function HomeworkDetailsModal({ item, onClose }) {
  if (!item) return null;

  const studentRows = Array.isArray(item.student_rows) ? item.student_rows : [];
  const submittedRows = studentRows.filter((row) => String(row.status || "").toLowerCase() === "submitted");
  const pendingRows = studentRows.filter((row) => String(row.status || "").toLowerCase() !== "submitted");
  const dueDateLabel = formatDate(item.due_date);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-10 pb-8">
      <div className="max-h-[calc(100vh-8rem)] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Homework details</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Close</button>
          </div>
        </div>
        <div className="max-h-[calc(100vh-8rem-92px)] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Homework info</p>
              <p className="mt-2"><strong>Class:</strong> {item.class_level || item.course_title || "-"}</p>
              <p className="mt-1"><strong>Subject:</strong> {item.subject_name || "-"}</p>
              <p className="mt-1"><strong>Teacher:</strong> {item.teacher_name || "-"}</p>
              <p className="mt-1"><strong>Due date:</strong> {dueDateLabel}</p>
              <p className="mt-1"><strong>Total students:</strong> {item.total_students_count || 0}</p>
              <p className="mt-1"><strong>Submitted:</strong> {submittedRows.length}</p>
              <p className="mt-1"><strong>Not submitted:</strong> {pendingRows.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Description</p>
              <p className="mt-2 whitespace-pre-line">{item.description || "No description."}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[1fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Student</span>
              <span>Username</span>
              <span>Status</span>
            </div>
            {studentRows.length ? studentRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 text-sm text-slate-600">
                <span>{row.student_name || "-"}</span>
                <span>{row.student_username || "-"}</span>
                <span className={String(row.status || "").toLowerCase() === "submitted" ? "font-semibold text-emerald-700" : "text-slate-600"}>{row.status || "pending"}</span>
              </div>
            )) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">No student rows available.</div>
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
      <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Homework</th>
                <th className="px-4 py-3">Lecture</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Pending</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.length ? visibleItems.map((item, index) => (
                <tr key={`${item.lecture_id}-${index}`}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.description || "No description."}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatLectureLabel(item)}</td>
                  <td className="px-4 py-4 text-slate-600">{item.class_level || item.course_title || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.subject_name || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(item.due_date)}</td>
                  <td className="px-4 py-4 text-slate-600">{item.submitted_count || 0}</td>
                  <td className="px-4 py-4 text-slate-600">{item.pending_count || 0}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setDetailsItem(item)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">View details</button>
                      <button type="button" onClick={() => setEditItem(item)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Edit</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No homework created yet.</td>
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
  });
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setForm({
      lectureId: item.lecture_id || "",
      title: item.title || "",
      description: item.description || "",
      dueDate: item.due_date ? String(item.due_date).slice(0, 10) : "",
    });
  }, [item]);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/teacher/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          lectureId: item.lecture_id,
        }),
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-28 pb-8">
      <div className="max-h-[calc(100vh-8rem)] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Edit homework</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Close
          </button>
        </div>
        <form onSubmit={submit} className="max-h-[calc(100vh-8rem-92px)] overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Homework title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" required />
            <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Lecture is fixed for edit
            </div>
          </div>
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="mt-3 min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={pending} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              {pending ? "Saving..." : "Update homework"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
