"use client";

import { useEffect, useState } from "react";
import { LeafSpinnerInline } from "@/components/shared/AshShajrahLoaders";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-PK", { timeZone: "Asia/Karachi", dateStyle: "medium" });
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
      if (!response.ok) throw new Error(data?.message || "Unable to submit homework.");
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
      <div className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#F1EADC] text-left text-sm">
          <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)]">
            <tr className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0D5C48]">
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Subject</th>
              <th className="px-6 py-4">Teacher</th>
              <th className="px-6 py-4">Due Date</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1EADC] bg-transparent">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-6 py-4 font-semibold text-[#063F32]">
                  {item.title || "Homework"}
                  <p className="mt-1 max-w-lg font-normal text-[#245C4F]">{item.description || item.lecture_title || "Homework details pending."}</p>
                </td>
                <td className="px-6 py-4 text-[#245C4F]">{item.subject_name || "Not available"}</td>
                <td className="px-6 py-4 text-[#245C4F]">{item.teacher_name || "Not available"}</td>
                <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.due_date || item.created_at)}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-[#FFF5D6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#8A6B00]">
                    {item.status || "pending"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    type="button"
                    disabled={item.status === "submitted" || submittingId === item.id}
                    onClick={() => setActiveItem(item)}
                    className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {item.status === "submitted" ? "Submitted" : submittingId === item.id ? (
                      <span className="inline-flex items-center gap-2">
                        <LeafSpinnerInline />
                        Submitting...
                      </span>
                    ) : "Submit homework"}
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-sm text-[#245C4F]">No homework assigned.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </div>

      {activeItem ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#063F32]/45 px-4 pt-28 pb-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Submit homework</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">{activeItem.title || "Homework"}</h3>
                <p className="mt-1 text-sm text-[#245C4F]">{activeItem.subject_name || "Subject not available"}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <form onSubmit={submitHomework} className="space-y-4 p-6">
              <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-[#FAF7F0] p-4 text-sm text-[#245C4F]">
                <p className="font-semibold text-[#063F32]">Homework details</p>
                <p className="mt-2">{activeItem.description || activeItem.lecture_title || "Homework details pending."}</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#063F32]">Your submission note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-32 w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#C9A227] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  placeholder="Write your homework submission note here..."
                />
              </label>

              {modalError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{modalError}</div> : null}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveItem(null)}
                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-2xl bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FFF5D6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-2">
                      <LeafSpinnerInline />
                      Submitting...
                    </span>
                  ) : (
                    "Submit homework"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
