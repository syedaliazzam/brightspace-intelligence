"use client";

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
  async function submitHomework(item) {
    const note = window.prompt("Submission is required.");
    if (!note || !note.trim()) {
      window.alert("Submission is required.");
      return;
    }

    const response = await fetch(`/api/student/homework/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.message || "Unable to submit homework.");
    }
    onRefresh?.();
  }

  return (
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
                  disabled={item.status === "submitted"}
                  onClick={() => submitHomework(item).catch((error) => window.alert(error.message))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.status === "submitted" ? "Submitted" : "Submit homework"}
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
  );
}
