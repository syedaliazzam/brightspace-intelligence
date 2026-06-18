"use client";

import { useCallback, useEffect, useState } from "react";
import TeacherAssignmentForm from "@/components/coordinator/TeacherAssignmentForm";
import TeacherAssignmentTable from "@/components/coordinator/TeacherAssignmentTable";

const CACHE_KEY = "coordinator-teacher-assignments";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorTeacherAssignmentsPage() {
  const [state, setState] = useState(() => {
    const cached = readCache();

    return {
      items: cached?.items || [],
      teachers: cached?.teachers || [],
      students: cached?.students || [],
      courses: cached?.courses || [],
      subjects: cached?.subjects || [],
      error: "",
    };
  });

  const load = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setState((current) => ({
        ...current,
        items: cached.items || [],
        teachers: cached.teachers || [],
        students: cached.students || [],
        courses: cached.courses || [],
        subjects: cached.subjects || [],
        error: "",
      }));
    }

    const response = await fetch("/api/coordinator/teacher-assignments", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load teacher assignments.");
    }

    writeCache(data);
    setState({
      items: data.items || [],
      teachers: data.teachers || [],
      students: data.students || [],
      courses: data.courses || [],
      subjects: data.subjects || [],
      error: "",
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((error) =>
        setState((current) => ({ ...current, error: error.message }))
      );
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Teacher assignments</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Match teachers to learning paths</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Assign active teachers to students, courses, and subject responsibilities while keeping operational status visible.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {state.items.length} assignments loaded
          </div>
        </div>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherAssignmentForm options={state} onSuccess={() => load().catch((error) => window.alert(error.message))} />
      <TeacherAssignmentTable items={state.items} onRefresh={() => load().catch((error) => window.alert(error.message))} />
    </div>
  );
}
