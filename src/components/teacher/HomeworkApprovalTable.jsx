"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/components/teacher/PaginationControls";

function HomeworkSubmissionModal({ item, onClose, onAction }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-28 pb-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Approve homework</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {item.student_name} · {item.subject_name} · {item.class_level}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Submission info</p>
              <p className="mt-2"><strong>Teacher:</strong> {item.teacher_name || "-"}</p>
              <p className="mt-1"><strong>Due date:</strong> {item.due_date ? new Date(item.due_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : "-"}</p>
              <p className="mt-1"><strong>Status:</strong> {item.status || "-"}</p>
              <p className="mt-1"><strong>Submitted text:</strong> {item.submission_note || "No text submitted."}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-950">Homework text</p>
              <p className="mt-2 whitespace-pre-line">{item.description || "No description."}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onAction("reject")}
              className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => onAction("approve")}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RejectHomeworkModal({ onClose, onSubmit }) {
  const [remarks, setRemarks] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/45 px-4 pt-28 pb-8">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-700">Reject homework</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Add rejection reason</h3>
          <p className="mt-1 text-sm text-slate-600">This will keep the homework in pending state so the student can resubmit.</p>
        </div>

        <div className="space-y-4 p-6">
          <textarea
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-slate-400"
            placeholder="Write rejection reason..."
          />

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(remarks)}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Reject homework
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeworkApprovalTable({ items = [], onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [rejecting, setRejecting] = useState(null);
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

  async function handleAction(item, action, reason = "") {
    const response = await fetch(`/api/teacher/homework/submissions/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, remarks: reason }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to update homework submission.");
    }
    setSelected(null);
    setRejecting(null);
    onRefresh?.();
  }

  return (
    <>
      <section className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Homework</th>
                <th className="px-4 py-3">Due Date</th>
                <th className="px-4 py-3">Submitted Note</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleItems.length ? visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-4 font-semibold text-slate-950">{item.student_name || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.class_level || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.subject_name || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.title || "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.due_date ? new Date(item.due_date).toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" }) : "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{item.submission_note || "No note."}</td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setSelected(item)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      View / Review
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No homework submissions waiting for review.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {items.length > pageSize ? (
          <PaginationControls page={page} pageSize={pageSize} totalItems={items.length} onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))} />
        ) : null}
      </section>

      <HomeworkSubmissionModal
        item={selected}
        onClose={() => setSelected(null)}
        onAction={(action) => {
          if (action === "reject") {
            setRejecting({ item: selected, remarks: "" });
            return;
          }
          handleAction(selected, action).catch((error) => window.alert(error.message));
        }}
      />

      {rejecting?.item ? (
        <RejectHomeworkModal
          onClose={() => setRejecting(null)}
          onSubmit={(remarks) => {
            handleAction(rejecting.item, "reject", remarks).catch((error) => window.alert(error.message));
          }}
        />
      ) : null}
    </>
  );
}
