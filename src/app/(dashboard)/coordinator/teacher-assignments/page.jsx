"use client";

import { useCallback, useEffect, useState } from "react";
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

    const items = (data.items || []).filter((item) => String(item?.status || "").toLowerCase() !== "suspended");

    setState({
      items,
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
    async function initialize() {
      try {
        await load();
      } catch (error) {
        setState((current) => ({ ...current, loading: false, error: error.message }));
      }
    }

    initialize();
  }, [load]);

  return (
    <div className="min-h-screen space-y-6 rounded-[2rem] bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,rgba(13,59,46,0.96),rgba(13,92,72,0.95))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(6,63,50,0.45)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Class and subject assignments</h1>
        <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
          Assign teachers to class subjects and manage active assignments.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherAssignmentForm options={state} onSuccess={load} />
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading assignments...</div> : null}
      <ShowMoreSection
        items={state.items}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <TeacherAssignmentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No teacher assignments available."
      />
      </div>
    </div>
  );
}
