"use client";

import { useEffect, useRef, useState } from "react";

export default function LectureScheduleForm({ options, onSuccess }) {
  const [form, setForm] = useState({
    courseId: "",
    studentIds: [],
    teacherId: "",
    subjectId: "",
    title: "",
    description: "",
    scheduledStart: "",
    scheduledEnd: "",
    googleMeetLink: "",
  });
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherNotice, setTeacherNotice] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const assignmentLookupRef = useRef(0);

  useEffect(() => {
    let active = true;

    async function loadClasses() {
      const response = await fetch("/api/coordinator/classes", { cache: "no-store" });
      const data = await response.json();

      if (active && response.ok) {
        setClasses(data.items || []);
      }
    }

    void loadClasses();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadClassData() {
      if (!form.courseId) {
        setStudents([]);
        setSubjects([]);
        setTeachers([]);
        setTeacherNotice("");
        return;
      }

      setLoadingOptions(true);

      try {
        const [studentsResponse, subjectsResponse] = await Promise.all([
          fetch(`/api/coordinator/classes/${form.courseId}/students`, { cache: "no-store" }),
          fetch(`/api/coordinator/classes/${form.courseId}/subjects`, { cache: "no-store" }),
        ]);
        const [studentsData, subjectsData] = await Promise.all([
          studentsResponse.json(),
          subjectsResponse.json(),
        ]);

        if (!studentsResponse.ok) {
          throw new Error(studentsData?.message || "Unable to load class students.");
        }
        if (!subjectsResponse.ok) {
          throw new Error(subjectsData?.message || "Unable to load class subjects.");
        }

        if (active) {
          setStudents(studentsData.items || []);
          setSubjects(subjectsData.items || []);
          setTeachers([]);
        }
      } catch (error) {
        if (active) {
          setStudents([]);
          setSubjects([]);
          setTeachers([]);
          window.alert(error instanceof Error ? error.message : "Unable to load class data.");
        }
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    void loadClassData();

    return () => {
      active = false;
    };
  }, [form.courseId]);

  useEffect(() => {
    let active = true;

    async function loadAssignedTeachers() {
      if (!form.courseId || !form.subjectId) {
        setTeachers([]);
        setTeacherNotice("");
        setForm((current) => ({ ...current, teacherId: "" }));
        return;
      }

      setTeachersLoading(true);
      setTeacherNotice("");

      try {
        const lookupId = ++assignmentLookupRef.current;
        const response = await fetch(
          `/api/coordinator/teacher-assignments/lookup?course_id=${encodeURIComponent(form.courseId)}&subject_id=${encodeURIComponent(form.subjectId)}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load assigned teachers.");
        }

        if (active) {
          const assignedTeachers = data.items || [];
          setTeachers(assignedTeachers);

          if (lookupId === assignmentLookupRef.current) {
            if (assignedTeachers.length === 1) {
              setForm((current) => ({ ...current, teacherId: assignedTeachers[0].teacher_id }));
            } else {
              setForm((current) => ({ ...current, teacherId: "" }));
            }
          }

          if (!assignedTeachers.length) {
            setTeacherNotice("No teacher assigned for this class and subject.");
          }
        }
      } catch {
        if (active) {
          setTeachers([]);
          setTeacherNotice("No teacher assigned for this class and subject.");
          setForm((current) => ({ ...current, teacherId: "" }));
        }
      } finally {
        if (active) {
          setTeachersLoading(false);
        }
      }
    }

    void loadAssignedTeachers();

    return () => {
      active = false;
    };
  }, [form.courseId, form.subjectId]);

  function addMinutesToLocalInput(value, minutes) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() + minutes);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function updateScheduledStart(value) {
    setForm((current) => {
      const nextEnd = addMinutesToLocalInput(value, 60);
      const currentEnd = current.scheduledEnd ? new Date(current.scheduledEnd) : null;
      const nextStart = value ? new Date(value) : null;

      return {
        ...current,
        scheduledStart: value,
        scheduledEnd:
          !currentEnd ||
          !nextStart ||
          Number.isNaN(currentEnd.getTime()) ||
          currentEnd <= nextStart
            ? nextEnd
            : current.scheduledEnd,
      };
    });
  }

  function toggleStudent(studentId) {
    setForm((current) => ({
      ...current,
      studentIds: current.studentIds.includes(studentId)
        ? current.studentIds.filter((id) => id !== studentId)
        : [...current.studentIds, studentId],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const startDate = new Date(form.scheduledStart);
    const endDate = new Date(form.scheduledEnd);

    if (!form.courseId || !form.subjectId || !form.teacherId || !form.title) {
      window.alert("Class, subject, teacher, and title are required.");
      return;
    }

    const meetLink = form.googleMeetLink.trim();

    if (!meetLink) {
      window.alert("Google Meet link is required.");
      return;
    }

    if (!meetLink.startsWith("https://meet.google.com/")) {
      window.alert("Google Meet link must start with https://meet.google.com/.");
      return;
    }

    if (!form.studentIds.length) {
      window.alert("Select at least one student.");
      return;
    }

    if (
      !form.scheduledStart ||
      !form.scheduledEnd ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate
    ) {
      window.alert("Lecture end time must be later than the start time.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/coordinator/lecture-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, googleMeetLink: meetLink }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to schedule lecture.");
      }

      setForm({
        courseId: "",
        studentIds: [],
        teacherId: "",
        subjectId: "",
        title: "",
        description: "",
        scheduledStart: "",
        scheduledEnd: "",
        googleMeetLink: "",
      });
      setStudents([]);
      setSubjects([]);
      setTeachers([]);
      setTeacherNotice("");
      onSuccess?.();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to schedule lecture.");
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = students.length > 0 && form.studentIds.length === students.length;

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:grid-cols-2">
      <select value={form.courseId} onChange={(event) => setForm((current) => ({ ...current, courseId: event.target.value, studentIds: [], subjectId: "", teacherId: "" }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">Select class</option>
        {classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
      </select>

      <select value={form.subjectId} onChange={(event) => setForm((current) => ({ ...current, subjectId: event.target.value, teacherId: "" }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <option value="">{loadingOptions ? "Loading subjects..." : form.courseId ? "Select class subject" : "Select class first"}</option>
        {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>

      <select
        value={form.teacherId}
        onChange={(event) => setForm((current) => ({ ...current, teacherId: event.target.value }))}
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
      >
        <option value="">
          {teachersLoading ? "Loading assigned teacher..." : form.subjectId ? "Select assigned teacher" : "Select subject first"}
        </option>
        {teachers.map((item) => (
          <option key={item.teacher_id} value={item.teacher_id}>
            {item.teacher_name}
          </option>
        ))}
      </select>

      {teacherNotice ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{teacherNotice}</p> : null}

      <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Lecture title" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <input
        value={form.googleMeetLink}
        onChange={(event) => setForm((current) => ({ ...current, googleMeetLink: event.target.value }))}
        placeholder="Google Meet Link"
        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm lg:col-span-2"
      />

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                studentIds: event.target.checked ? students.map((student) => student.id) : [],
              }))
            }
          />
          Select all students
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <label key={student.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
              <input
                type="checkbox"
                checked={form.studentIds.includes(student.id)}
                onChange={() => toggleStudent(student.id)}
              />
              {student.full_name}
            </label>
          ))}
          {!students.length ? (
        <p className="text-sm text-slate-500">
          {form.courseId ? "No active students found for this class." : "Select a class to load students."}
        </p>
      ) : null}
      </div>
      </div>

      <input type="datetime-local" value={form.scheduledStart} onChange={(event) => updateScheduledStart(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <input type="datetime-local" value={form.scheduledEnd} onChange={(event) => setForm((current) => ({ ...current, scheduledEnd: event.target.value }))} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" />
      <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Coordinator notes or agenda" className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm lg:col-span-2" />

      <button type="submit" disabled={submitting} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white lg:col-span-2">
        {submitting ? "Saving..." : "Schedule for selected students"}
      </button>
    </form>
  );
}
