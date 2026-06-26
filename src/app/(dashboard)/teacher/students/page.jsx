"use client";

import { useEffect, useState } from "react";
import AssignedStudentsTable from "@/components/teacher/AssignedStudentsTable";

export default function TeacherStudentsPage() {
  const [state, setState] = useState({ items: [], subject: "", error: "" });

  const subjects = Array.from(
    new Map(
      state.items
        .filter((item) => item.subject_name)
        .map((item) => [String(item.subject_name), { value: item.subject_name, label: item.subject_name }])
    ).values()
  );

  const visibleItems = state.subject
    ? state.items.filter((item) => String(item.subject_name || "") === String(state.subject))
    : state.items;

  useEffect(() => {
    fetch("/api/teacher/students", { cache: "no-store" }).then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data?.message || "Unable to load students.");
      setState((current) => ({ ...current, items: data.items || [], error: "" }));
    })).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);
  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Students</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Assigned learners</h1></section>
      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <label className="block max-w-sm">
          <span className="mb-2 block text-sm font-medium text-slate-700">Subject</span>
          <select
            value={state.subject}
            onChange={(event) => setState((current) => ({ ...current, subject: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-400"
          >
            <option value="">All subjects</option>
            {subjects.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <AssignedStudentsTable items={visibleItems} />
    </div>
  );
}
