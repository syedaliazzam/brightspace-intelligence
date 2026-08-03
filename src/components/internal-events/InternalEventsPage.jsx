"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Copy, FileVideo, Link as LinkIcon, Plus, RefreshCw } from "lucide-react";

const APP_TIMEZONE = "Asia/Karachi";

const VISIBILITY_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parents" },
  { value: "superadmin", label: "Super Admin" },
];

function toggleRoleSelection(currentRoles = [], role) {
  if (!role) return currentRoles;
  const nextRoles = currentRoles.includes(role)
    ? currentRoles.filter((item) => item !== role)
    : [...currentRoles, role];
  return Array.from(new Set(nextRoles));
}

function toPakistanDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PK", { timeZone: APP_TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

function roleLabel(value) {
  return String(value || "")
    .replace(/^superadmin$/i, "Super Admin")
    .replace(/^cohost$/i, "Co-host")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function eventStatus(item) {
  const status = String(item?.status || "").toLowerCase();
  const start = item?.scheduled_start ? new Date(item.scheduled_start) : null;
  const end = item?.scheduled_end ? new Date(item.scheduled_end) : null;
  const now = new Date();

  if (status === "cancelled") return "Cancelled";
  if (status === "live") return "Live";
  if (status === "completed" || status === "completed_by_teacher" || status === "verified_by_coordinator") return "Completed";
  if (status === "missed" || status === "rescheduled" || status === "disputed") return "Follow-up";
  if (status === "ended") return "Ended";

  if (start && end) {
    if (now > end) return "Ended";
    if (now >= start && now <= end) return "Live";
    return "Upcoming";
  }

  if (status === "upcoming" || status === "scheduled") return "Upcoming";

  return "Upcoming";
}

function statusTone(item) {
  const status = String(item?.status || "").toLowerCase();
  const start = item?.scheduled_start ? new Date(item.scheduled_start) : null;
  const end = item?.scheduled_end ? new Date(item.scheduled_end) : null;
  const now = new Date();

  if (status === "cancelled") return "bg-[#FDECEC] text-[#B91C1C]";
  if (status === "live") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (status === "completed" || status === "completed_by_teacher" || status === "verified_by_coordinator") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (status === "missed" || status === "rescheduled" || status === "disputed") return "bg-[#FFF7ED] text-[#C2410C]";
  if (status === "ended") return "bg-[#F1EADC] text-[#7A5E2B]";

  if (start && end) {
    if (now > end) return "bg-[#F1EADC] text-[#7A5E2B]";
    if (now >= start && now <= end) return "bg-[#EAF6EF] text-[#0D5C48]";
    return "bg-[#EEF4FF] text-[#1D4ED8]";
  }

  if (status === "upcoming" || status === "scheduled") return "bg-[#EEF4FF] text-[#1D4ED8]";

  return "bg-[#EEF4FF] text-[#1D4ED8]";
}

export default function InternalEventsPage({
  portalLabel = "Coordinator portal",
  canCreate = true,
} = {}) {
  const [items, setItems] = useState([]);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [attendeeOpen, setAttendeeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleToRoles, setVisibleToRoles] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    attendeeUserId: "",
    scheduledStart: "",
    scheduledEnd: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const response = await fetch(`/api/internal-events?${params.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load events.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load events.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadOptions = useCallback(async () => {
    if (!canCreate) return;
    const response = await fetch("/api/internal-events?mode=options", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setAttendees(Array.isArray(data.attendees) ? data.attendees : []);
  }, [canCreate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOptions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const summary = useMemo(
    () => ({
      total: items.length,
      withMeet: items.filter((item) => item.google_meet_link).length,
      recorded: items.filter((item) => item.recording_drive_url).length,
    }),
    [items]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/internal-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, visibleToRoles }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create event.");
      setMessage(data?.calendar_error ? data.message : "Event created successfully.");
      setForm({
        title: "",
        description: "",
        attendeeUserId: "",
        scheduledStart: "",
        scheduledEnd: "",
      });
      setVisibleToRoles([]);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create event.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mb-3 mt-4 font-display text-3xl font-bold text-white-deep sm:text-4xl">
                Internal Events
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
                Create and review internal events with one selected attendee, a coordinator-hosted Meet link, and recording sync.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.total}</p>
                <p className="text-xs text-[#EAF6EF]">Events</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.withMeet}</p>
                <p className="text-xs text-[#EAF6EF]">Meet</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{summary.recorded}</p>
                <p className="text-xs text-[#EAF6EF]">Recorded</p>
              </div>
            </div>
          </div>
        </section>

        {canCreate ? (
          <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Attendee</span>
                <div className="relative">
                  <select
                    value={form.attendeeUserId}
                    onMouseDown={() => setAttendeeOpen((current) => !current)}
                    onChange={(event) => {
                      setAttendeeOpen(false);
                      setForm((current) => ({ ...current, attendeeUserId: event.target.value }));
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                    required
                  >
                    <option value="">Select attendee</option>
                    {attendees.map((attendee) => (
                      <option key={attendee.id} value={attendee.id}>
                        {attendee.full_name} - {roleLabel(attendee.role_name)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${attendeeOpen ? "rotate-180" : ""}`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start time</span>
                <input
                  type="datetime-local"
                  value={form.scheduledStart}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledStart: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End time</span>
                <input
                  type="datetime-local"
                  value={form.scheduledEnd}
                  onChange={(event) => setForm((current) => ({ ...current, scheduledEnd: event.target.value }))}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                  required
                />
              </label>
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Description</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
                />
              </label>
              <fieldset className="block lg:col-span-2">
                <legend className="mb-2 block text-sm font-semibold text-[#245C4F]">Visible to portals</legend>

                <div className="rounded-2xl border border-[#2D8A6A]/20 bg-white p-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {VISIBILITY_ROLE_OPTIONS.map((option) => {
                      const checked = visibleToRoles.includes(option.value);
                      const inputId = `visibility-role-${option.value}`;

                      return (
                        <label
                          key={option.value}
                          htmlFor={inputId}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-[#2D8A6A] bg-[#EAF6EF]"
                              : "border-[#2D8A6A]/10 bg-[#FAF7F0]"
                          }`}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            value={option.value}
                            checked={checked}
                            onChange={() => {
                              setVisibleToRoles((currentRoles) => toggleRoleSelection(currentRoles, option.value));
                            }}
                            className="h-4 w-4 rounded border-[#2D8A6A] text-[#0D5C48] focus:ring-[#2D8A6A]"
                          />

                          <span className="font-medium text-[#245C4F]">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-2 text-xs text-[#2D8A6A]">Select one or more roles. Leave empty to show the event to all portals.</p>
              </fieldset>
              <div className="lg:col-span-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-5 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_16px_34px_-24px_rgba(13,59,46,0.65)] disabled:opacity-70"
                >
                  {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="border-b border-[#2D8A6A]/10 px-5 py-5">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search event, host, attendee, or description"
              className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#2D8A6A]/20"
            />
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-5 py-5">
            <h2 className="text-lg font-semibold text-[#063F32]">Event records</h2>
            <span className="rounded-full bg-[#EAF6EF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
              {items.length} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-[#245C4F]">
              <thead className="bg-[#FAF7F0] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Host</th>
                  <th className="px-5 py-3 font-semibold">Attendee</th>
                  <th className="px-5 py-3 font-semibold">Start</th>
                  <th className="px-5 py-3 font-semibold">End</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-[#2D8A6A]/10 transition"
                    >
                      <td className="px-5 py-4 font-medium text-[#063F32]">{item.title}</td>
                      <td className="px-5 py-4">{item.host_name || "Coordinator"}</td>
                      <td className="px-5 py-4">{item.attendee_name || "-"}</td>
                      <td className="px-5 py-4">{formatDateTime(item.scheduled_start)}</td>
                      <td className="px-5 py-4">{formatDateTime(item.scheduled_end)}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(item)}`}>
                          {eventStatus(item)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-[#245C4F]">
                      {loading ? "Loading events..." : "No internal events available."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {message ? (
          <div className="fixed right-4 top-4 z-[10000] rounded-2xl border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_18px_40px_-24px_rgba(13,59,46,0.55)]">
            {message}
          </div>
        ) : null}

      </div>

    </div>
  );
}
