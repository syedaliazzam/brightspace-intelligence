"use client";

import { useEffect, useState } from "react";
import AssignedStudentsTable from "@/components/teacher/AssignedStudentsTable";

export default function TeacherStudentsPage() {
  const [state, setState] = useState({ items: [], error: "" });
  useEffect(() => {
    fetch("/api/teacher/students", { cache: "no-store" }).then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data?.message || "Unable to load students.");
      setState({ items: data.items || [], error: "" });
    })).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Students</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Assigned learners</h1></section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <AssignedStudentsTable items={state.items} />
    </div>
  );
}
