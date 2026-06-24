"use client";

import { useCallback, useEffect, useState } from "react";
import LectureScheduleForm from "@/components/coordinator/LectureScheduleForm";
import LectureScheduleTable from "@/components/coordinator/LectureScheduleTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";

export default function CoordinatorLectureSchedulesPage() {
  const [state, setState] = useState({
    items: [],
    students: [],
    enrollments: [],
    subjects: [],
    teachers: [],
    classes: [],
    error: "",
    loading: true,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/lecture-schedules", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load lecture schedules.");
    }

    setState({
      items: data.items || [],
      students: data.students || [],
      enrollments: data.enrollments || [],
      subjects: data.subjects || [],
      teachers: data.teachers || [],
      classes: data.classes || data.courses || [],
      error: "",
      loading: false,
    });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState((current) => ({ ...current, loading: false, error: error.message }))
    );
  }, [load]);

  return (
    <div className="min-h-screen space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Plan classes and Meet sessions</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Create lectures, assign teachers, and manage class timing changes.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {state.items.length} lectures loaded
          </div>
        </div>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <LectureScheduleForm options={state} onSuccess={load} />
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading lecture schedules...</div> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <LectureScheduleTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No lecture schedules available."
      />
    </div>
  );
}
