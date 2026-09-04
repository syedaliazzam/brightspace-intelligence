"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ClientPortal from "@/components/shared/ClientPortal";
import { getLectureDisplayStatus, getLecturePrimaryLink } from "@/lib/lectureStatus";

const EMPTY_FORM = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  googleMeetLink: "",
};

function getOccurrenceRows(item) {
  if (item?.is_occurrence_row) return [];

  const details =
    item?.occurrence_details && typeof item.occurrence_details === "object"
      ? item.occurrence_details
      : {};

  return Object.entries(details)
    .map(([dateKey, detail]) => ({
      dateKey,
      ...(detail && typeof detail === "object" ? detail : {}),
    }))
    .filter((detail) => detail.id || detail.scheduled_start || detail.start_time)
    .sort((a, b) => String(a.scheduled_start || a.dateKey).localeCompare(String(b.scheduled_start || b.dateKey)));
}

export function expandLectureScheduleRows(items) {
  return (items || []).flatMap((item) => {
    const occurrences = getOccurrenceRows(item);
    if (occurrences.length <= 1) {
      const occurrence = occurrences[0] || {};
      return [{
        ...item,
        is_occurrence_row: true,
        id: occurrence.id || item.id,
        scheduled_start: occurrence.scheduled_start || item.scheduled_start,
        scheduled_end: occurrence.scheduled_end || item.scheduled_end,
        start_date: occurrence.dateKey || item.start_date,
        end_date: occurrence.scheduled_end ? String(occurrence.scheduled_end).replace(" ", "T").split("T")[0] : item.end_date,
        start_time: occurrence.start_time || item.start_time,
        end_time: occurrence.end_time || item.end_time,
      }];
    }

    return occurrences.map((occurrence, index) => ({
      ...item,
      is_occurrence_row: true,
      id: occurrence.id || item.id,
      schedule_group_id: item.id,
      scheduled_start: occurrence.scheduled_start || item.scheduled_start,
      scheduled_end: occurrence.scheduled_end || item.scheduled_end,
      start_date: occurrence.dateKey || item.start_date,
      end_date: occurrence.scheduled_end ? String(occurrence.scheduled_end).replace(" ", "T").split("T")[0] : occurrence.dateKey || item.end_date,
      start_time: occurrence.start_time || item.start_time,
      end_time: occurrence.end_time || item.end_time,
    }));
  });
}

function getLectureDayLabel(item) {
  const rawDate = item?.start_date || item?.scheduled_start;
  if (!rawDate) return item?.days_active || "N/A";

  const normalized = String(rawDate).includes("T") ? String(rawDate) : `${rawDate}T00:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return item?.days_active || "N/A";

  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export default function LectureScheduleTable({ items = [], onRefresh }) {
  const finalStatuses = new Set(["cancelled", "verified_by_coordinator", "completed_by_teacher"]);
  const scheduleRows = expandLectureScheduleRows(items);
  const [editingItem, setEditingItem] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);

  async function patchSchedule(id, payload) {
    const response = await fetch(`/api/coordinator/lecture-schedules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("Unable to update lecture schedule. Please refresh and try again.");
    }

    if (!response.ok) {
      throw new Error(data?.message || "Unable to update lecture schedule.");
    }

    onRefresh?.();
  }

  function openEdit(item) {
    const rawStart = String(item.scheduled_start || "").replace(" ", "T");
    const rawEnd = String(item.scheduled_end || "").replace(" ", "T");

    const startDate = item.start_date || (rawStart ? rawStart.split("T")[0] : "");
    const endDate = item.end_date || (rawEnd ? rawEnd.split("T")[0] : startDate);
    const startTime = item.start_time || (rawStart.includes("T") ? rawStart.split("T")[1]?.slice(0, 5) : "");
    const endTime = item.end_time || (rawEnd.includes("T") ? rawEnd.split("T")[1]?.slice(0, 5) : "");

    setEditingItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      startDate: startDate || "",
      endDate: endDate || startDate || "",
      startTime: startTime || "",
      endTime: endTime || "",
      googleMeetLink: item.google_meet_link || "",
    });
    setFormError("");
  }

  function closeEdit() {
    if (saving) return;
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function openCancelConfirm(item) {
    setCancelTarget(item);
    setCancelError("");
  }

  function closeCancelConfirm() {
    if (canceling) return;
    setCancelTarget(null);
    setCancelError("");
  }

  async function confirmCancelSchedule() {
    if (!cancelTarget) return;

    setCanceling(true);
    setCancelError("");

    try {
      await patchSchedule(cancelTarget.id, { action: "cancel" });
      setCancelTarget(null);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "Unable to cancel lecture schedule.");
    } finally {
      setCanceling(false);
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (!editingItem) return;

    if (!form.title.trim()) {
      setFormError("Lecture title is required.");
      return;
    }

    if (!form.startDate || !form.endDate) {
      setFormError("Start date and end date are required.");
      return;
    }

    if (form.endDate < form.startDate) {
      setFormError("End date must be on or after start date.");
      return;
    }

    if (!form.startTime || !form.endTime) {
      setFormError("Start time and end time are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const scheduledStart = `${form.startDate}T${form.startTime}:00`;
      const scheduledEnd = `${form.endDate}T${form.endTime}:00`;
      const scheduledStartDate = new Date(scheduledStart);
      const scheduledEndDate = new Date(scheduledEnd);

      if (
        Number.isNaN(scheduledStartDate.getTime()) ||
        Number.isNaN(scheduledEndDate.getTime()) ||
        scheduledEndDate <= scheduledStartDate
      ) {
        setFormError("Lecture end time must be after the start time.");
        return;
      }

      await patchSchedule(editingItem.id, {
        action: "update",
        title: form.title.trim(),
        description: form.description.trim(),
        scheduledStart,
        scheduledEnd,
        googleMeetLink: editingItem.google_meet_link || "",
      });

      setEditingItem(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to update lecture schedule.");
    } finally {
      setSaving(false);
    }
  }

  function promptReschedule(item) {
    const scheduledStart = window.prompt("New start (YYYY-MM-DDTHH:mm)", item.scheduled_start?.replace(" ", "T").slice(0, 16) || "");
    const scheduledEnd = window.prompt("New end (YYYY-MM-DDTHH:mm)", item.scheduled_end?.replace(" ", "T").slice(0, 16) || "");
    if (!scheduledStart || !scheduledEnd) return;
    const googleMeetLink = window.prompt("New Google Meet Link (optional fallback)", item.google_meet_link || "") || "";
    if (googleMeetLink.trim() && !googleMeetLink.trim().startsWith("https://meet.google.com/")) {
      window.alert("Google Meet link must start with https://meet.google.com/.");
      return;
    }
    const notes = window.prompt("Optional reason / notes", item.description || "") || "";
    patchSchedule(item.id, { action: "reschedule", scheduledStart, scheduledEnd, googleMeetLink: googleMeetLink.trim(), description: notes }).catch((error) => window.alert(error.message));
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
        <div className="hidden grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(96px,1fr)_minmax(96px,1fr)_minmax(92px,0.9fr)_minmax(92px,0.9fr)_minmax(70px,0.7fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_220px] gap-3 border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48] lg:grid lg:items-center">
          <span>Lecture</span>
          <span>Subject</span>
          <span className="whitespace-nowrap">Start date</span>
          <span className="whitespace-nowrap">End date</span>
          <span className="whitespace-nowrap">Start time</span>
          <span className="whitespace-nowrap">End time</span>
          <span>Days</span>
          <span>Status</span>
          <span>Class</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-[#2D8A6A]/10">
          {scheduleRows.length ? (
            scheduleRows.map((item) => {
              const statusKey = String(item.status || "").toLowerCase();
              const isFinal = finalStatuses.has(statusKey);
              const primaryLink = getLecturePrimaryLink(item);

              return (
                <div key={item.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(96px,1fr)_minmax(96px,1fr)_minmax(92px,0.9fr)_minmax(92px,0.9fr)_minmax(70px,0.7fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_220px] lg:items-center">
                  <div>
                    <p className="font-semibold text-[#063F32]">{item.title}</p>
                    <p className="mt-1 text-sm text-[#245C4F]">
                      {item.student_count > 1 ? `${item.student_count} students` : item.student_names} with {item.teacher_name}
                    </p>
                  </div>
                  <p className="text-sm text-[#245C4F]">{item.subject_name}</p>
                  <p className="text-sm text-[#245C4F]">{item.start_date || String(item.scheduled_start || '').split('T')[0]}</p>
                  <p className="text-sm text-[#245C4F]">{item.end_date || String(item.scheduled_end || '').split('T')[0]}</p>
                  <p className="text-sm text-[#245C4F]">{item.start_time || ''}</p>
                  <p className="text-sm text-[#245C4F]">{item.end_time || ''}</p>
                  <p className="text-sm text-[#245C4F]">{getLectureDayLabel(item)}</p>
                  <p className="min-w-0 text-sm leading-6 text-[#245C4F] break-words">{item.display_status || item.status || getLectureDisplayStatus(item)}</p>
                  <div className="min-w-0 text-sm leading-6 text-[#245C4F] break-words">
                    <p>{item.course_title}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      disabled={isFinal}
                      onClick={() => openEdit(item)}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={isFinal}
                      onClick={() => promptReschedule(item)}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reschedule
                    </button>
                    <button
                      type="button"
                      disabled={isFinal}
                      onClick={() => openCancelConfirm(item)}
                      className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-5 py-10 text-sm text-[#245C4F]">No lecture schedules available.</div>
          )}
        </div>
      </motion.div>

      {editingItem ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[9999] isolate flex min-h-full items-center justify-center overflow-visible bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-[2rem] border border-[#2D8A6A]/20 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.24)]">
              <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-[#063F32]">Edit Lecture Schedule</h2>
                  <p className="mt-1 text-sm text-[#245C4F]">Update lecture details and timings.</p>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              {formError ? (
                <div className="mx-6 mt-5 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-[0_14px_30px_-24px_rgba(225,29,72,0.25)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">Update blocked</p>
                      <p className="mt-1 font-medium">{formError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormError("")}
                      className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Context Summary Cards */}
              <div className="mx-6 mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0]/80 p-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="block font-medium text-[#2D8A6A]">Class</span>
                  <span className="font-semibold text-[#063F32]">{editingItem.course_title || "N/A"}</span>
                </div>
                <div>
                  <span className="block font-medium text-[#2D8A6A]">Subject</span>
                  <span className="font-semibold text-[#063F32]">{editingItem.subject_name || "N/A"}</span>
                </div>
                <div>
                  <span className="block font-medium text-[#2D8A6A]">Teacher</span>
                  <span className="font-semibold text-[#063F32]">{editingItem.teacher_name || "N/A"}</span>
                </div>
                <div>
                  <span className="block font-medium text-[#2D8A6A]">Students</span>
                  <span className="font-semibold text-[#063F32]">
                    {editingItem.student_count > 1 ? `${editingItem.student_count} students` : editingItem.student_names || "N/A"}
                  </span>
                </div>
              </div>

              <form onSubmit={submitEdit} className="px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-[#245C4F]">Lecture Title</span>
                    <input
                      required
                      value={form.title}
                      onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                      placeholder="e.g. Mathematics Session 1"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[#245C4F]">Start Date</span>
                    <input
                      type="date"
                      required
                      value={form.startDate}
                      onChange={(e) => setForm((current) => ({ ...current, startDate: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[#245C4F]">End Date</span>
                    <input
                      type="date"
                      required
                      value={form.endDate}
                      onChange={(e) => setForm((current) => ({ ...current, endDate: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[#245C4F]">Start Time</span>
                    <input
                      type="time"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm((current) => ({ ...current, startTime: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-[#245C4F]">End Time</span>
                    <input
                      type="time"
                      required
                      value={form.endTime}
                      onChange={(e) => setForm((current) => ({ ...current, endTime: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-start">
                      <span className="text-sm font-medium text-[#245C4F]">Google Meet Link</span>
                    </div>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={editingItem.google_meet_link || "No Meet link assigned"}
                      className="w-full cursor-not-allowed rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0]/70 px-4 py-3 text-sm text-[#063F32]/70 outline-none select-all"
                    />
                    <span className="block text-xs text-[#2D8A6A]/70">Google Meet link cannot be edited.</span>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-medium text-[#245C4F]">Description / Notes (Optional)</span>
                    <textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                      placeholder="Add any syllabus details or notes..."
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#2D8A6A]/10 pt-5">
                  <button
                    type="button"
                    onClick={closeEdit}
                    disabled={saving}
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      ) : null}

      {cancelTarget ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[10000] isolate flex min-h-full items-center justify-center bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-rose-200/70 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(6,63,50,0.35)]">
              <div className="border-b border-[#2D8A6A]/10 bg-[linear-gradient(135deg,#fff7ed,#fff1f2)] px-6 py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-700">
                  Cancel lecture
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">
                  Are you sure?
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#245C4F]">
                  This will cancel the selected lecture schedule only.
                </p>
              </div>

              <div className="space-y-4 px-6 py-5">
                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-white/75 p-4">
                  <p className="font-semibold text-[#063F32]">{cancelTarget.title || "Lecture schedule"}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {cancelTarget.subject_name || "Subject"} · {cancelTarget.course_title || "Class"}
                  </p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {cancelTarget.start_date || String(cancelTarget.scheduled_start || "").split("T")[0]} · {cancelTarget.start_time || ""}
                  </p>
                </div>

                {cancelError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                    {cancelError}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 border-t border-[#2D8A6A]/10 pt-5">
                  <button
                    type="button"
                    onClick={closeCancelConfirm}
                    disabled={canceling}
                    className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-50"
                  >
                    Keep lecture
                  </button>
                  <button
                    type="button"
                    onClick={confirmCancelSchedule}
                    disabled={canceling}
                    className="rounded-2xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {canceling ? "Cancelling..." : "Cancel lecture"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}
    </>
  );
}
