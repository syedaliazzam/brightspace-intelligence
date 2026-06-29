"use client";

import { motion } from "framer-motion";

function formatDateOnly(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (!text) return "-";
  return text.split("T")[0].replace(/\.000$/i, "");
}

export default function TeacherAssignmentTable({ items = [], onRefresh }) {
  async function updateStatus(id, status) {
    const response = await fetch(`/api/coordinator/teacher-assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update assignment.");
    }

    onRefresh?.();
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid lg:items-center">
        <span>Teacher</span>
        <span>Class</span>
        <span>Start month</span>
        <span>Subject / Status</span>
        <span className="text-right">Action</span>
      </div>
      <div className="divide-y divide-slate-200">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] lg:items-center">
              <p className="text-sm font-semibold text-slate-950">{item.teacher_name}</p>
              <p className="text-sm text-slate-600">{item.course_title || "-"}</p>
              <p className="text-sm text-slate-700">{formatDateOnly(item.start_date || item.created_at)}</p>
              <div>
                <p className="text-sm text-slate-700">{item.subject_name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.status}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateStatus(item.id, item.status === "active" ? "suspended" : "active").catch((error) =>
                    window.alert(error.message)
                  )
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 lg:justify-self-end"
              >
                {item.status === "active" ? "Suspend" : "Activate"}
              </button>
            </div>
          ))
        ) : (
          <div className="px-5 py-10 text-sm text-slate-500">No teacher assignments available.</div>
        )}
      </div>
    </motion.div>
  );
}
