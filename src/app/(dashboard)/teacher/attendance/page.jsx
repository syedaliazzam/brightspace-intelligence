"use client";

import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
  { label: "Leave", value: "leave" },
];

export default function TeacherAttendancePage() {
  const [state, setState] = useState({
    classes: [],
    subjects: [],
    lectures: [],
    selectedLecture: null,
    students: [],
    filters: {
      classLevel: "",
      subjectId: "",
      lectureId: "",
    },
    saving: false,
    loading: false,
    error: "",
  });

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(await response.text());
    }
    return response.json();
  }

  async function load(nextFilters = state.filters) {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const params = new URLSearchParams();
      if (nextFilters.classLevel) params.set("classLevel", nextFilters.classLevel);
      if (nextFilters.subjectId) params.set("subjectId", nextFilters.subjectId);
      if (nextFilters.lectureId) params.set("lectureId", nextFilters.lectureId);
      const response = await fetch(`/api/teacher/attendance?${params.toString()}`, { cache: "no-store" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to load attendance.");
      setState((current) => ({
        ...current,
        classes: Array.isArray(data.classes) ? data.classes : [],
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        lectures: Array.isArray(data.lectures) ? data.lectures : [],
        selectedLecture: data.selectedLecture || null,
        students: Array.isArray(data.students) ? data.students : [],
        filters: nextFilters,
        loading: false,
        error: "",
      }));
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roster = useMemo(
    () =>
      state.students.map((student) => ({
        ...student,
        currentStatus: String(student.currentStatus || student.status || "absent").toLowerCase(),
      })),
    [state.students]
  );

  const lectureLabel = (item) => {
    const dateLabel = item.scheduled_start ? new Date(item.scheduled_start).toLocaleDateString() : "";
    return `${item.title}${dateLabel ? ` - ${dateLabel}` : ""}${item.subject_name ? ` - ${item.subject_name}` : ""}${item.class_level ? ` (${item.class_level})` : ""}`;
  };

  async function saveAttendance() {
    if (!state.selectedLecture?.id) {
      setState((current) => ({ ...current, error: "Please select an ended lecture first." }));
      return;
    }

    setState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const response = await fetch("/api/teacher/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureId: state.selectedLecture.id,
          students: roster.map((student) => ({
            studentUserId: student.user_id || student.id,
            status: student.currentStatus,
          })),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data?.message || "Unable to save attendance.");
      await load(state.filters);
    } catch (error) {
      setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setState((current) => ({ ...current, saving: false }));
    }
  }

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Attendance</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Manual student attendance</h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-600">Select a class, subject, and ended lecture to mark student attendance. Teacher Meet attendance remains synced separately.</p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Class</span>
            <select
              value={state.filters.classLevel}
              onChange={(event) =>
                load({ classLevel: event.target.value, subjectId: "", lectureId: "" }).then(() =>
                  setState((current) => ({ ...current, selectedLecture: null, students: [] }))
                )
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <option value="">Select class</option>
              {state.classes.map((item) => (
                <option key={item.class_level} value={item.class_level}>
                  {item.class_level}
                  {item.course_title ? ` - ${item.course_title}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Subject</span>
            <select
              value={state.filters.subjectId}
              onChange={(event) =>
                load({ ...state.filters, subjectId: event.target.value, lectureId: "" }).then(() =>
                  setState((current) => ({ ...current, selectedLecture: null, students: [] }))
                )
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              disabled={!state.filters.classLevel && state.subjects.length === 0}
            >
              <option value="">Select subject</option>
              {state.subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Ended lecture</span>
            <select
              value={state.filters.lectureId}
              onChange={(event) => load({ ...state.filters, lectureId: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              disabled={!state.lectures.length}
            >
              <option value="">Select lecture</option>
              {state.lectures.map((item) => (
                <option key={item.id} value={item.id}>
                  {lectureLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {state.loading ? <p className="mt-4 text-sm text-slate-500">Loading attendance...</p> : null}
      </section>

      {state.selectedLecture ? (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Lecture</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">{state.selectedLecture.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{state.selectedLecture.subject_name} · {state.selectedLecture.class_level}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                {state.students.some((student) => String(student.source || "").toLowerCase() === "manual")
                  ? "Edit saved attendance"
                  : "Mark attendance"}
              </p>
            </div>
            <button
              onClick={saveAttendance}
              disabled={state.saving || !roster.length}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.saving ? "Saving..." : "Save / Update attendance"}
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Username</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Attendance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.length ? (
                  roster.map((student) => (
                    <tr key={student.student_id}>
                      <td className="px-3 py-4 font-semibold text-slate-950">{student.full_name}</td>
                      <td className="px-3 py-4 text-slate-600">{student.username || "-"}</td>
                      <td className="px-3 py-4 text-slate-600">{student.email || "-"}</td>
                      <td className="px-3 py-4 text-slate-600">{student.phone || "-"}</td>
                      <td className="px-3 py-4">
                        <select
                          value={student.currentStatus}
                          onChange={(event) =>
                            setState((current) => ({
                              ...current,
                              students: current.students.map((item) =>
                                item.student_id === student.student_id ? { ...item, currentStatus: event.target.value } : item
                              ),
                            }))
                          }
                          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      No students found for this lecture.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
