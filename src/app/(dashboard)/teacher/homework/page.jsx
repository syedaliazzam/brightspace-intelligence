"use client";

import { useEffect, useState } from "react";
import HomeworkForm from "@/components/teacher/HomeworkForm";
import HomeworkTable from "@/components/teacher/HomeworkTable";

export default function TeacherHomeworkPage() {
  const [state, setState] = useState({ classes: [], items: [], error: "" });
  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load() {
    const [classesResponse, homeworkResponse] = await Promise.all([fetch("/api/teacher/lectures", { cache: "no-store" }), fetch("/api/teacher/homework", { cache: "no-store" })]);
    const classesData = await readJson(classesResponse);
    const homeworkData = await readJson(homeworkResponse);
    if (!classesResponse.ok || !homeworkResponse.ok) throw new Error(classesData?.message || homeworkData?.message || "Unable to load homework.");
    setState({ classes: classesData.items || [], items: homeworkData.items || [], error: "" });
  }
  useEffect(() => { load().catch((error) => setState((current) => ({ ...current, error: error.message }))); }, []);
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Homework</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Create and review homework</h1></section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <HomeworkForm lectures={state.classes} onSaved={() => load()} />
      <HomeworkTable items={state.items} />
    </div>
  );
}
