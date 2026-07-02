"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

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
    filters: { classLevel: "", subjectId: "", lectureId: "" },
    saving: false,
    loading: false,
    error: "",
  });
  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);

  async function readJson(response) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) throw new Error(await response.text());
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
    <div className="min-h-screen rounded-[2rem] border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none rounded-[2rem] border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#E4C766]">Attendance</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Manual student attendance</h1>
          <p className="mt-3 max-w-2xl text-sm text-[#F1EADC]">Select a class, subject, and ended lecture to mark student attendance. Teacher Meet attendance remains synced separately.</p>
        </section>

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Class</span>
              <div className="relative">
                <select
                  value={state.filters.classLevel}
                  onMouseDown={() => setClassOpen((current) => !current)}
                  onChange={(event) => {
                    setClassOpen(false);
                    load({ classLevel: event.target.value, subjectId: "", lectureId: "" }).then(() => setState((current) => ({ ...current, selectedLecture: null, students: [] })));
                  }}
                  onFocus={() => setClassOpen(true)}
                  onBlur={() => setClassOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                >
                  <option value="">Select class</option>
                  {state.classes.map((item) => (
                    <option key={item.class_level} value={item.class_level}>
                      {item.class_level}
                      {item.course_title ? ` - ${item.course_title}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Subject</span>
              <div className="relative">
                <select
                  value={state.filters.subjectId}
                  onMouseDown={() => setSubjectOpen((current) => !current)}
                  onChange={(event) => {
                    setSubjectOpen(false);
                    load({ ...state.filters, subjectId: event.target.value, lectureId: "" }).then(() => setState((current) => ({ ...current, selectedLecture: null, students: [] })));
                  }}
                  onFocus={() => setSubjectOpen(true)}
                  onBlur={() => setSubjectOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  disabled={!state.filters.classLevel && state.subjects.length === 0}
                >
                  <option value="">Select subject</option>
                  {state.subjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${subjectOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#245C4F]">Ended lecture</span>
              <div className="relative">
                <select
                  value={state.filters.lectureId}
                  onMouseDown={() => setLectureOpen((current) => !current)}
                  onChange={(event) => {
                    setLectureOpen(false);
                    load({ ...state.filters, lectureId: event.target.value });
                  }}
                  onFocus={() => setLectureOpen(true)}
                  onBlur={() => setLectureOpen(false)}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  disabled={!state.lectures.length}
                >
                  <option value="">Select lecture</option>
                  {state.lectures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {lectureLabel(item)}
                    </option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${lectureOpen ? "rotate-180" : "rotate-0"}`} />
              </div>
            </label>
          </div>

          {state.loading ? <p className="mt-4 text-sm text-[#245C4F]">Loading attendance...</p> : null}
        </section>

        {state.selectedLecture ? (
          <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0D5C48]">Lecture</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{state.selectedLecture.title}</h2>
                <p className="mt-1 text-sm text-[#245C4F]">{state.selectedLecture.subject_name} Â· {state.selectedLecture.class_level}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                  {state.students.some((student) => String(student.source || "").toLowerCase() === "manual")
                    ? "Edit saved attendance"
                    : "Mark attendance"}
                </p>
              </div>
              <button
                onClick={saveAttendance}
                disabled={state.saving || !roster.length}
                className="rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.saving ? "Saving..." : "Save / Update attendance"}
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Username</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EADC]">
                  {roster.length ? (
                    roster.map((student) => (
                      <tr key={student.student_id}>
                        <td className="px-3 py-4 font-semibold text-[#063F32]">{student.full_name}</td>
                        <td className="px-3 py-4 text-[#245C4F]">{student.username || "-"}</td>
                        <td className="px-3 py-4 text-[#245C4F]">{student.email || "-"}</td>
                        <td className="px-3 py-4 text-[#245C4F]">{student.phone || "-"}</td>
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
                            className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
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
                      <td colSpan={5} className="px-3 py-8 text-center text-[#245C4F]">
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
    </div>
  );
}
