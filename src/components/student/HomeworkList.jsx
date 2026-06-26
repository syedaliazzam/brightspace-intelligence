"use client";

import { useEffect, useState } from "react";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
  });
}

export default function HomeworkList({ items = [], onRefresh }) {
  const [submittingId, setSubmittingId] = useState("");
  const [activeItem, setActiveItem] = useState(null);
  const [note, setNote] = useState("");
  const [modalError, setModalError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (activeItem) {
      setNote("");
      setModalError("");
    }
  }, [activeItem]);

  async function submitHomework(event) {
    event.preventDefault();
    if (!activeItem) return;
    if (!note.trim()) {
      setModalError("Submission is required.");
      return;
    }

    setPending(true);
    setSubmittingId(activeItem.id);
    try {
      const response = await fetch(`/api/student/homework/${activeItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Unable to submit homework.");
      }
      onRefresh?.();
      setSubmittingId("");
      setPending(false);
      setActiveItem(null);
    } catch (error) {
      setModalError(error instanceof Error ? error.message : "Unable to submit homework.");
      setSubmittingId("");
      setPending(false);
    }
  }

  return (
    <>
      <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50">
          <tr className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3">Teacher</th>
            <th className="px-4 py-3">Due Date</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => (
            <tr key={item.id} className="align-top">
              <td className="px-4 py-4 font-semibold text-slate-950">
                {item.title || "Homework"}
                <p className="mt-1 max-w-lg font-normal text-slate-500">
                  {item.description || item.lecture_title || "Homework details pending."}
                </p>
              </td>
              <td className="px-4 py-4 text-slate-600">{item.subject_name || "Not available"}</td>
              <td className="px-4 py-4 text-slate-600">{item.teacher_name || "Not available"}</td>
              <td className="px-4 py-4 text-slate-600">{formatDate(item.due_date || item.created_at)}</td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
                  {item.status || "pending"}
                </span>
              </td>
              <td className="px-4 py-4">
                <button
                  type="button"
                  disabled={item.status === "submitted" || submittingId === item.id}
                  onClick={() => setActiveItem(item)}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.status === "submitted" ? "Submitted" : submittingId === item.id ? "Submitting..." : "Submit homework"}
                </button>
              </td>
            </tr>
          ))}
          {!items.length ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-sm text-slate-600">
                No homework assigned.
              </td>
            </tr>
          ) : null}
        </tbody>
        </table>
      </div>

      {activeItem ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 px-4 pt-28 pb-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Submit homework</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{activeItem.title || "Homework"}</h3>
                <p className="mt-1 text-sm text-slate-600">{activeItem.subject_name || "Subject not available"}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitHomework} className="space-y-4 p-6">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Homework details</p>
                <p className="mt-2">{activeItem.description || activeItem.lecture_title || "Homework details pending."}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Your submission note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  placeholder="Write your homework submission note here..."
                />
              </label>

              {modalError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{modalError}</div> : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Submitting..." : "Submit homework"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
