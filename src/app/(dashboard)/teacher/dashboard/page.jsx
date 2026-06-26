"use client";

import { useEffect, useState } from "react";
import TeacherStatsCards from "@/components/teacher/TeacherStatsCards";
import ClassActionModal from "@/components/teacher/ClassActionModal";
import LMSCalendar from "@/components/calendar/LMSCalendar";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function TeacherDashboardPage() {
  const [state, setState] = useState({
    stats: {},
    classes: [],
    selected: null,
    calendarRefreshKey: 0,
    filters: {
      date: todayDate(),
      range: "today",
      classLevel: "",
      subjectId: "",
      status: "",
    },
    error: "",
  });

  async function load() {
    const response = await fetch("/api/teacher/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load dashboard.");
    setState((current) => ({ ...current, stats: data.stats || {}, error: "" }));
  }

  async function loadLectures(filters = state.filters) {
    const safeFilters = {
      ...filters,
      date: filters.date || todayDate(),
      classLevel: filters.classLevel || "",
      subjectId: filters.subjectId || "",
      status: filters.status || "",
    };
    const response = await fetch(`/api/teacher/calendar-lectures?${new URLSearchParams(safeFilters).toString()}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({
      ...current,
      filters: safeFilters,
      classes: Array.isArray(data.classes) ? data.classes : [],
    }));
  }

  function updateFilters(nextFilters) {
    setState((current) => ({ ...current, filters: nextFilters }));
    loadLectures(nextFilters).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }

  async function markConducted(item) {
    const response = await fetch(`/api/teacher/lectures/${item.id}`, { method: "PATCH" });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data?.message || "Unable to mark conducted.");
      return;
    }
    await load();
    setState((current) => ({ ...current, calendarRefreshKey: current.calendarRefreshKey + 1 }));
  }

  useEffect(() => {
    async function initialize() {
      try {
        await load();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadLectures({
          date: todayDate(),
          range: "today",
          classLevel: "",
          subjectId: "",
          status: "",
        });
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(239,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Teacher dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Teaching operations</h1>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <TeacherStatsCards items={[
        { key: "today", label: "Today lectures", value: state.stats.today_lectures || 0 },
        { key: "upcoming", label: "Upcoming lectures", value: state.stats.upcoming_lectures || 0 },
        { key: "students", label: "Assigned students", value: state.stats.assigned_students || 0 },
        { key: "subjects", label: "Assigned subjects", value: state.stats.assigned_subjects || 0 },
      ]} />
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Class</span>
            <select
              value={state.filters.classLevel}
              onChange={(event) => updateFilters({ ...state.filters, classLevel: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-sky-400"
            >
              <option value="">All classes</option>
              {state.classes.map((item) => (
                <option key={item.class_level} value={item.class_level}>
                  {item.class_level}
                  {item.title ? ` - ${item.title}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <LMSCalendar
          key={state.calendarRefreshKey}
          apiUrl="/api/teacher/calendar-lectures"
          filters={state.filters}
          onDateSelect={(date) => updateFilters({ ...state.filters, date, range: "selected_date" })}
          onEventClick={(item) => setState((current) => ({ ...current, selected: item }))}
        />
      </section>
      <ClassActionModal lecture={state.selected} open={Boolean(state.selected)} onClose={() => setState((current) => ({ ...current, selected: null }))} onChanged={() => load()} />
    </div>
  );
}
