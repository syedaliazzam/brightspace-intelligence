"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { X } from "lucide-react";

const FILTER_OPTIONS = [
  { id: "all", label: "All Events" },
  { id: "class-schedulers", label: "My Classes" },
  { id: "public-events", label: "Public Events" },
  { id: "internal-events", label: "Internal Events" },
];

function parseDateTime(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCalendarDate(date) {
  if (!date) return "";
  const dateValue = new Date(date);
  if (Number.isNaN(dateValue.getTime())) return "";
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  const hours = String(dateValue.getHours()).padStart(2, "0");
  const minutes = String(dateValue.getMinutes()).padStart(2, "0");
  const seconds = String(dateValue.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function mapTeacherLectures(items = []) {
  return (items || []).map((item) => {
    const start = parseDateTime(item?.rescheduled_start || item?.scheduled_start);
    const end = parseDateTime(item?.rescheduled_end || item?.scheduled_end);
    const title = item?.title || item?.subject_name || "Class";

    return {
      id: `class-${item.id}`,
      title,
      start: start ? toCalendarDate(start) : "",
      end: end ? toCalendarDate(end) : "",
      backgroundColor: "#10B981",
      borderColor: "#059669",
      textColor: "#FFFFFF",
      extendedProps: {
        type: "class-schedulers",
        typeLabel: "Class",
        subtitle: item?.subject_name || item?.class_level || "Your lecture",
        meetLink: item?.google_meet_link || "",
        recordingLink: item?.event_detail_link?.href || "",
        recordingKind: item?.event_detail_link?.kind || "",
        recordingLabel: item?.event_detail_link?.label || "",
      },
    };
  });
}

function mapPublicEvents(items = []) {
  return (items || []).map((item) => {
    const start = parseDateTime(item?.start_at || item?.startAt);
    const end = parseDateTime(item?.end_at || item?.endAt);

    return {
      id: `public-${item.id}`,
      title: item?.title || "Public event",
      start: start ? toCalendarDate(start) : "",
      end: end ? toCalendarDate(end) : "",
      backgroundColor: "#2563EB",
      borderColor: "#1D4ED8",
      textColor: "#FFFFFF",
      extendedProps: {
        type: "public-events",
        typeLabel: "Public",
        subtitle: item?.publication_status || "Public event",
        meetLink: item?.meet_link || item?.google_meet_link || item?.meeting_link || "",
        recordingLink: item?.recording_link || item?.event_detail_link?.href || "",
        recordingKind: item?.event_detail_link?.kind || "",
        recordingLabel: item?.event_detail_link?.label || "",
      },
    };
  });
}

function mapInternalEvents(items = []) {
  return (items || []).map((item) => {
    const start = parseDateTime(item?.scheduled_start);
    const end = parseDateTime(item?.scheduled_end);

    return {
      id: `internal-${item.id}`,
      title: item?.title || "Internal event",
      start: start ? toCalendarDate(start) : "",
      end: end ? toCalendarDate(end) : "",
      backgroundColor: "#F59E0B",
      borderColor: "#D97706",
      textColor: "#FFFFFF",
      extendedProps: {
        type: "internal-events",
        typeLabel: "Internal",
        subtitle: item?.host_name || "Internal event",
        meetLink: item?.google_meet_link || item?.meeting_link || "",
        recordingLink: item?.recording_link || item?.event_detail_link?.href || "",
        recordingKind: item?.event_detail_link?.kind || "",
        recordingLabel: item?.event_detail_link?.label || "",
      },
    };
  });
}

export default function TeacherEventsCalendarPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [copiedLink, setCopiedLink] = useState("");
  const [state, setState] = useState({
    loading: true,
    error: "",
    classEvents: [],
    publicEvents: [],
    internalEvents: [],
  });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: "" }));

      try {
        const [lectureResult, publicResult, internalResult] = await Promise.allSettled([
          fetch("/api/teacher/lectures?range=all", { cache: "no-store" }),
          fetch("/api/public-events", { cache: "no-store" }),
          fetch("/api/internal-events", { cache: "no-store" }),
        ]);

        const lectureData = lectureResult.status === "fulfilled" ? await lectureResult.value.json().catch(() => ({ items: [] })) : { items: [] };
        const publicData = publicResult.status === "fulfilled" ? await publicResult.value.json().catch(() => ({ items: [] })) : { items: [] };
        const internalData = internalResult.status === "fulfilled" ? await internalResult.value.json().catch(() => ({ items: [] })) : { items: [] };

        if (!active) return;

        setState({
          loading: false,
          error: "",
          classEvents: Array.isArray(lectureData?.items) ? mapTeacherLectures(lectureData.items) : [],
          publicEvents: Array.isArray(publicData?.items) ? mapPublicEvents(publicData.items) : [],
          internalEvents: Array.isArray(internalData?.items) ? mapInternalEvents(internalData.items) : [],
        });
      } catch (error) {
        if (!active) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load event calendar.",
          classEvents: [],
          publicEvents: [],
          internalEvents: [],
        });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const calendarEvents = useMemo(() => {
    const classEvents = activeFilter === "all" || activeFilter === "class-schedulers" ? state.classEvents : [];
    const publicEvents = activeFilter === "all" || activeFilter === "public-events" ? state.publicEvents : [];
    const internalEvents = activeFilter === "all" || activeFilter === "internal-events" ? state.internalEvents : [];

    return [...classEvents, ...publicEvents, ...internalEvents];
  }, [activeFilter, state.classEvents, state.publicEvents, state.internalEvents]);

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#063F32]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.14),transparent_28%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-5xl">
              <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                Teacher portal
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold text-white-deep sm:text-4xl">
                All Events Calendar
              </h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
                View your assigned classes and public events in one calendar.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 text-sm text-[#FAF7F0]">
              {calendarEvents.length} events shown
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="flex flex-wrap gap-2 pb-4 border-b border-[#2D8A6A]/10">
            {FILTER_OPTIONS.map((option) => {
              const isActive = activeFilter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveFilter(option.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#0D5C48] text-[#FAF7F0] shadow-[0_12px_28px_-18px_rgba(13,59,46,0.55)]"
                      : "border border-[#2D8A6A]/15 bg-white text-[#063F32] hover:border-[#2D8A6A]/30"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#10B981" }}></div>
              <span className="text-xs font-medium text-[#063F32]">My Classes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#2563EB" }}></div>
              <span className="text-xs font-medium text-[#063F32]">Public</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: "#F59E0B" }}></div>
              <span className="text-xs font-medium text-[#063F32]">Internal</span>
            </div>
          </div>
        </section>

        {state.error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {state.error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white p-3 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
            events={calendarEvents}
            eventDisplay="block"
            height="auto"
            expandRows
            nowIndicator
            weekends
            editable={false}
            selectable={false}
            allDaySlot={false}
            slotDuration="01:00:00"
            slotLabelInterval="01:00:00"
            slotMinTime="08:00:00"
            slotMaxTime="18:00:00"
            scrollTime="08:00:00"
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            eventClassNames={() => ["cursor-pointer"]}
            eventClick={(info) => setSelectedEvent(info.event)}
            eventContent={(arg) => (
              <div className="overflow-hidden px-1 text-[11px] leading-tight text-white">
                <div className="flex items-center gap-1">
                  <span className="rounded-full bg-white/15 px-1.5 py-[1px] text-[8px] font-semibold uppercase tracking-[0.12em]">
                    {arg.event.extendedProps?.typeLabel || "Event"}
                  </span>
                </div>
                <div className="mt-1 truncate font-semibold">{arg.event.title}</div>
                {arg.event.extendedProps?.subtitle ? (
                  <div className="truncate text-[10px] text-white/85">{arg.event.extendedProps.subtitle}</div>
                ) : null}
              </div>
            )}
          />
          {state.loading ? <p className="mt-3 text-sm text-[#245C4F]">Loading event calendar...</p> : null}
          {!state.loading && calendarEvents.length === 0 ? (
            <p className="mt-3 text-sm text-[#245C4F]">No events found.</p>
          ) : null}
        </div>

        {selectedEvent ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#063F32]/45 px-4 pt-16 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">{selectedEvent.extendedProps?.typeLabel || "Event"}</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#063F32]">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-[#245C4F] hover:text-[#063F32]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 p-6 text-sm text-[#245C4F]">
                {selectedEvent.extendedProps?.subtitle && (
                  <p><strong className="text-[#063F32]">Details:</strong> {selectedEvent.extendedProps.subtitle}</p>
                )}
                <p><strong className="text-[#063F32]">Start:</strong> {selectedEvent.start?.toLocaleString() || "N/A"}</p>
                <p><strong className="text-[#063F32]">End:</strong> {selectedEvent.end?.toLocaleString() || "N/A"}</p>
                {selectedEvent.extendedProps?.meetLink && (
                  <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Class Joining Link</p>
                        <p className="mt-2 break-all text-sm text-[#245C4F]">{selectedEvent.extendedProps.meetLink}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedEvent.extendedProps.meetLink);
                            setCopiedLink(selectedEvent.extendedProps.meetLink);
                            setTimeout(() => setCopiedLink(""), 2000);
                          }}
                          className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48] hover:bg-[#F1EADC]"
                        >
                          {copiedLink === selectedEvent.extendedProps.meetLink ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={selectedEvent.extendedProps.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]"
                        >
                          Join Class
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {selectedEvent.extendedProps?.recordingLink && selectedEvent.extendedProps.recordingLink !== selectedEvent.extendedProps.meetLink && (
                  <a
                    href={selectedEvent.extendedProps.recordingLink}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${selectedEvent.extendedProps.recordingKind === "recording" ? "bg-[#FAF7F0] text-[#0D5C48] ring-1 ring-[#2D8A6A]/20" : "bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]"}`}
                  >
                    {selectedEvent.extendedProps.recordingLabel || "View Recording"}
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
