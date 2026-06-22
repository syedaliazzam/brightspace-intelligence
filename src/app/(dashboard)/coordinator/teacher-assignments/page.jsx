"use client";

import { useCallback, useEffect, useState } from "react";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import TeacherAssignmentForm from "@/components/coordinator/TeacherAssignmentForm";
import TeacherAssignmentTable from "@/components/coordinator/TeacherAssignmentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";

export default function CoordinatorTeacherAssignmentsPage() {
  const [state, setState] = useState({
    items: [],
    teachers: [],
    students: [],
    courses: [],
    subjects: [],
    courseSubjects: [],
    loading: true,
    error: "",
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/teacher-assignments", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load teacher assignments.");
    }

    setState({
      items: data.items || [],
      teachers: data.teachers || [],
      students: data.students || [],
      courses: data.courses || [],
      subjects: data.subjects || [],
      courseSubjects: data.courseSubjects || [],
      loading: false,
      error: "",
    });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState((current) => ({ ...current, loading: false, error: error.message }))
    );
  }, [load]);

  return (
    <div className="space-y-6">
      <CoordinatorPortalNavbar />
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Teacher assignments</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Class and subject assignments</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Assign teachers to class subjects and manage active assignments.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherAssignmentForm options={state} onSuccess={load} />
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading assignments...</div> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={10}
        step={10}
        renderItems={(visibleItems) => <TeacherAssignmentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No teacher assignments available."
      />
    </div>
  );
}
