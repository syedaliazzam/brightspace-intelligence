"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import StudentPortalNavbar from "@/components/student/StudentPortalNavbar";
import StudentStatsCards from "@/components/student/StudentStatsCards";
import HomeworkList from "@/components/student/HomeworkList";
import AttendanceSummary from "@/components/student/AttendanceSummary";
import NoteThreadsBoard from "@/components/shared/NoteThreadsBoard";
import LMSCalendar from "@/components/calendar/LMSCalendar";
import PaymentAccessGuard from "@/components/shared/PaymentAccessGuard";
import ActiveHeadlinesBanner from "@/components/shared/ActiveHeadlinesBanner";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function StudentDashboardPage() {
  const [state, setState] = useState({
    stats: {},
    headlines: [],
    lectures: [],
    homework: [],
    attendance: { summary: {}, items: [] },
    profile: null,
    subjects: [],
    markedDates: [],
    loading: true,
    error: "",
    filters: { date: todayDate(), range: "today", subjectId: "", status: "" },
  });

  async function loadDashboard() {
    const response = await fetch("/api/student/dashboard", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load dashboard.");
    setState((current) => ({
      ...current,
      stats: data.stats || {},
      headlines: Array.isArray(data.headlines) ? data.headlines : [],
      error: "",
    }));
  }

  async function loadHomework() {
    const response = await fetch("/api/student/homework", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load homework.");
    setState((current) => ({ ...current, homework: data.items || [] }));
  }

  async function loadAttendance() {
    const response = await fetch("/api/student/attendance", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load attendance.");
    setState((current) => ({ ...current, attendance: { summary: data.summary || {}, items: data.items || [] } }));
  }

  async function loadProfile() {
    const response = await fetch("/api/student/profile", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
    setState((current) => ({ ...current, profile: data.profile || null }));
  }

  async function loadLectures(filters = state.filters) {
    const safe = { ...filters, date: filters.date || todayDate() };
    const params = new URLSearchParams(safe);
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch(`/api/student/calendar-lectures?${params.toString()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "Unable to load lectures.");
    setState((current) => ({ ...current, filters: { ...current.filters, date: safe.date }, lectures: data.items || [], subjects: data.subjects || [], markedDates: data.markedDates || [], loading: false, error: "" }));
  }

  function updateFilters(filters) {
    setState((current) => ({ ...current, filters }));
    loadLectures(filters).catch((error) => setState((current) => ({ ...current, loading: false, error: error.message })));
  }

  useEffect(() => {
    async function initialize() {
      try {
        await loadDashboard();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadHomework();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadAttendance();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        await loadProfile();
      } catch (error) {
        setState((current) => ({ ...current, error: error instanceof Error ? error.message : String(error) }));
      }

      try {
        const initialFilters = { date: todayDate(), range: "today", subjectId: "", status: "" };
        await loadLectures(initialFilters);
      } catch (error) {
        setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : String(error) }));
      }
    }

    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const profile = state.profile || {};
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
    password: "",
  });
  const [editError, setEditError] = useState("");
  const [editPending, setEditPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleEditProfileSubmit(event) {
    event.preventDefault();
    setEditError("");
    setEditPending(true);

    try {
      const response = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Unable to update profile.");
      }
      setState((current) => ({ ...current, profile: data.profile || current.profile }));
      setEditProfileOpen(false);
      setEditForm((current) => ({ ...current, password: "" }));
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setEditPending(false);
    }
  }

  return (
    <PaymentAccessGuard>
      <div className="space-y-6">
      <StudentPortalNavbar profile={profile} />

      <ActiveHeadlinesBanner items={state.headlines} />

      <section id="dashboard" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(238,248,255,0.94))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Student dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Your learning command center</h1>
        {state.error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        <div className="mt-6">
          <StudentStatsCards items={[
            { key: "subjects", label: "Total Subjects", value: state.stats.total_subjects || 0 },
            { key: "homework", label: "Pending Homeworks", value: state.stats.pending_homeworks || 0 },
            { key: "lectures", label: "Total Lectures", value: state.stats.total_lectures || 0 },
            { key: "conducted", label: "Conducted Lectures", value: state.stats.conducted_lectures || 0 },
            { key: "present", label: "Lectures Present", value: state.stats.lectures_present || 0 },
            { key: "attendance", label: "Attendance Percentage", value: `${state.stats.attendance_percentage || 0}%` },
            { key: "fee", label: "Fee Status", value: state.stats.fee_status_label || "Not Paid" },
          ]} />
        </div>
      </section>

      <motion.section id="calendar" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Lecture Calendar</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Plan your study week</h2>
        </div>
        <LMSCalendar
          apiUrl="/api/student/calendar-lectures"
          filters={state.filters}
          onDateSelect={(date) => updateFilters({ ...state.filters, date, range: "selected_date" })}
        />
      </motion.section>

      <motion.section id="homework" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Homework</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Assigned work</h2>
        </div>
        <HomeworkList items={state.homework} onRefresh={() => loadHomework().catch((error) => setState((current) => ({ ...current, error: error.message })))} />
      </motion.section>

      <motion.section id="attendance" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Attendance</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Conducted lecture attendance</h2>
        </div>
        <AttendanceSummary summary={state.attendance.summary} items={state.attendance.items} />
      </motion.section>

      <motion.section id="notes" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Teacher notes</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Latest feedback and updates</h2>
        </div>
        <NoteThreadsBoard mode="viewer" />
      </motion.section>

      <motion.section id="profile" className="scroll-mt-28 rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">Profile</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Student details</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditForm({
                fullName: profile.full_name || "",
                phone: profile.phone || "",
                password: "",
              });
              setEditProfileOpen(true);
            }}
            className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Edit profile
          </button>
        </div>
        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
          <p><strong>Name:</strong> {profile.full_name || "Not available"}</p>
          <p><strong>Username:</strong> {profile.username || "Not available"}</p>
          <p><strong>Phone:</strong> {profile.phone || "Not available"}</p>
          <p><strong>Admission:</strong> {profile.admission_no || "Not assigned"}</p>
          <p><strong>Class:</strong> {profile.grade_level || "Not assigned"}</p>
          <p><strong>Father name:</strong> {profile.father_name || "Not assigned"}</p>
          <p><strong>Father phone:</strong> {profile.father_phone || "Not assigned"}</p>
        </div>
      </motion.section>

      {editProfileOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.32)] sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Edit profile</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Update your student account</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditProfileOpen(false)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form autoComplete="off" className="mt-6 grid gap-4" onSubmit={handleEditProfileSubmit}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                <input
                  type="text"
                  name="fullName"
                  autoComplete="name"
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  type="text"
                  name="phone"
                  autoComplete="tel"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">New password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="new-password"
                    autoComplete="new-password"
                    value={editForm.password}
                    onChange={(event) => setEditForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-500"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {editError ? (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{editError}</div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </div>
    </PaymentAccessGuard>
  );
}
