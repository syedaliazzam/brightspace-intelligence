"use client";

import { useEffect, useState } from "react";
import TeacherClassTable from "@/components/teacher/TeacherClassTable";
import ClassActionModal from "@/components/teacher/ClassActionModal";

const FILTERS = [
  { label: "All lectures", value: "" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Live", value: "live" },
  { label: "Ended", value: "ended" },
  { label: "Completed", value: "completed_by_teacher" },
  { label: "Verified", value: "verified_by_coordinator" },
  { label: "Missed", value: "missed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Rescheduled", value: "rescheduled" },
  { label: "Disputed", value: "disputed" },
];

export default function TeacherClassesPage() {
  const [state, setState] = useState({ items: [], selected: null, status: "", error: "" });

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load(status = state.status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const response = await fetch(`/api/teacher/lectures${query}`, { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || "Unable to load classes.");
    setState((current) => ({ ...current, items: data.items || [], status, error: "" }));
  }

  useEffect(() => { load().catch((error) => setState((current) => ({ ...current, error: error.message }))); }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Lectures</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Assigned lecture history</h1>
      </section>
      <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.value || "all"} onClick={() => load(item.value).catch((error) => setState((current) => ({ ...current, error: error.message })))} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${state.status === item.value ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>{item.label}</button>)}</div>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherClassTable items={state.items} onOpen={(item) => setState((current) => ({ ...current, selected: item }))} />
      <ClassActionModal lecture={state.selected} open={Boolean(state.selected)} onClose={() => setState((current) => ({ ...current, selected: null }))} onChanged={() => load()} />
    </div>
  );
}
