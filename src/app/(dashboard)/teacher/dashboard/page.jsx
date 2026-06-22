"use client";

import { useEffect, useState } from "react";
import TeacherStatsCards from "@/components/teacher/TeacherStatsCards";
import TodayClassesCard from "@/components/teacher/TodayClassesCard";
import ClassActionModal from "@/components/teacher/ClassActionModal";
import TeacherLectureCalendar from "@/components/teacher/TeacherLectureCalendar";
import TeacherSelectedDateLectures from "@/components/teacher/TeacherSelectedDateLectures";
import LMSCalendar from "@/components/calendar/LMSCalendar";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function TeacherDashboardPage() {
  const [state, setState] = useState({
    stats: {},
    today: [],
    selected: null,
    calendarLectures: [],
    subjects: [],
    markedDates: [],
    calendarLoading: true,
    filters: {
      date: "",
      range: "today",
      subjectId: "",
      status: "",
    },
    error: "",
  });

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load() {
    const response = await fetch("/api/teacher/dashboard", { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || "Unable to load dashboard.");
    setState((current) => ({ ...current, stats: data.stats || {}, today: data.today || [], error: "" }));
  }

  async function loadCalendar(filters = state.filters) {
    const safeFilters = { ...filters, date: filters.date || todayDate() };
    setState((current) => ({ ...current, calendarLoading: true }));
    const params = new URLSearchParams({
      date: safeFilters.date,
      range: safeFilters.range,
      subjectId: safeFilters.subjectId,
      status: safeFilters.status,
    });
    const response = await fetch(`/api/teacher/calendar-lectures?${params.toString()}`, { cache: "no-store" });
    const data = await readJson(response);
    if (!response.ok) throw new Error(data?.message || "Unable to load calendar lectures.");
    setState((current) => ({
      ...current,
      calendarLectures: data.items || [],
      subjects: data.subjects || current.subjects,
      markedDates: data.markedDates || current.markedDates,
      filters: { ...safeFilters },
      calendarLoading: false,
      error: "",
    }));
  }

  function updateFilters(nextFilters) {
    setState((current) => ({ ...current, filters: nextFilters }));
    loadCalendar(nextFilters).catch((error) => {
      setState((current) => ({ ...current, calendarLoading: false, error: error.message }));
    });
  }

  async function markConducted(item) {
    const response = await fetch(`/api/teacher/lectures/${item.id}`, { method: "PATCH" });
    const data = await readJson(response);
    if (!response.ok) {
      window.alert(data?.message || "Unable to mark conducted.");
      return;
    }
    await Promise.all([load(), loadCalendar()]);
  }

  useEffect(() => { load().catch((error) => setState((current) => ({ ...current, error: error.message }))); }, []);
  useEffect(() => {
    const initialFilters = { ...state.filters, date: todayDate() };
    setState((current) => ({ ...current, filters: initialFilters }));
    loadCalendar(initialFilters).catch((error) => setState((current) => ({ ...current, calendarLoading: false, error: error.message })));
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
        { key: "completed", label: "Completed this week", value: state.stats.completed_this_week || 0 },
        { key: "pending", label: "Pending reports", value: state.stats.pending_completion_reports || 0 },
        { key: "students", label: "Assigned students", value: state.stats.assigned_students || 0 },
        { key: "subjects", label: "Assigned subjects", value: state.stats.assigned_subjects || 0 },
      ]} />
      <TodayClassesCard items={state.today} onOpen={(item) => setState((current) => ({ ...current, selected: item }))} />
      <TeacherLectureCalendar filters={state.filters} subjects={state.subjects} markedDates={state.markedDates} onChange={updateFilters} />
      <LMSCalendar
        apiUrl="/api/teacher/calendar-lectures"
        filters={state.filters}
        onDateSelect={(date) => updateFilters({ ...state.filters, date, range: "selected_date" })}
      />
      <TeacherSelectedDateLectures items={state.calendarLectures} loading={state.calendarLoading} onMarkConducted={markConducted} />
      <ClassActionModal lecture={state.selected} open={Boolean(state.selected)} onClose={() => setState((current) => ({ ...current, selected: null }))} onChanged={() => load()} />
    </div>
  );
}
