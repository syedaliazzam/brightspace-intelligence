"use client";

import { useCallback, useEffect, useState } from "react";
import LectureScheduleForm from "@/components/coordinator/LectureScheduleForm";
import LectureScheduleTable from "@/components/coordinator/LectureScheduleTable";

const CACHE_KEY = "coordinator-lecture-schedules";
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

export default function CoordinatorLectureSchedulesPage() {
  const [state, setState] = useState(() => {
    const cached = readCache();

    return {
      items: cached?.items || [],
      students: cached?.students || [],
      enrollments: cached?.enrollments || [],
      subjects: cached?.subjects || [],
      teachers: cached?.teachers || [],
      error: "",
    };
  });

  const load = useCallback(async () => {
    const cached = readCache();
    if (cached) {
      setState((current) => ({
        ...current,
        items: cached.items || [],
        students: cached.students || [],
        enrollments: cached.enrollments || [],
        subjects: cached.subjects || [],
        teachers: cached.teachers || [],
        error: "",
      }));
    }

    const response = await fetch("/api/coordinator/lecture-schedules", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load lecture schedules.");
    }

    writeCache(data);
    setState({
      items: data.items || [],
      students: data.students || [],
      enrollments: data.enrollments || [],
      subjects: data.subjects || [],
      teachers: data.teachers || [],
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
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Lecture schedules</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Plan classes and Google Meet sessions</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Coordinate teaching calendars, Google Meet links, and class timing changes from one scheduling workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {state.items.length} lectures loaded
          </div>
        </div>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <LectureScheduleForm options={state} onSuccess={() => load().catch((error) => window.alert(error.message))} />
      <LectureScheduleTable items={state.items} onRefresh={() => load().catch((error) => window.alert(error.message))} />
    </div>
  );
}
