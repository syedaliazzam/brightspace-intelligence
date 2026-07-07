"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { canShowJoinMeet, getLectureDisplayStatus } from "@/lib/lectureStatus";

const APP_TIMEZONE = "Asia/Karachi";

function isJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json");
}

function parseDate(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";
  const normalized = text.includes("T") ? text : text.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

function formatLocalDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

function formatLocalDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PK", { timeZone: APP_TIMEZONE, dateStyle: "medium", timeStyle: "short" });
}

function pickActiveTime(lecture) {
  const start = lecture?.rescheduled_start || lecture?.rescheduledStartTime || lecture?.rescheduled_scheduled_start || lecture?.scheduled_start || lecture?.scheduledStart;
  const end = lecture?.rescheduled_end || lecture?.rescheduledEndTime || lecture?.rescheduled_scheduled_end || lecture?.scheduled_end || lecture?.scheduledEnd;
  return { start, end };
}

function getLectureTimeState(lecture) {
  const { start: startValue, end: endValue } = pickActiveTime(lecture);
  const start = startValue ? new Date(String(startValue).replace(" ", "T")) : null;
  const end = endValue ? new Date(String(endValue).replace(" ", "T")) : null;
  if (!start || Number.isNaN(start.getTime()) || !end || Number.isNaN(end.getTime())) return "upcoming";
  const now = new Date();
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "ended";
}

function canShowMeetLink(lecture) {
  return canShowJoinMeet(lecture);
}

export default function LMSCalendar({ apiUrl, filters = {}, extraParams = {}, onDateSelect, onEventClick, title = "Lecture calendar" }) {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("dayGridMonth");
  const activeDate = filters.date || formatLocalDate(new Date());
  const firstEventDate = events[0]?.start ? String(events[0].start).slice(0, 10) : "";

  const query = useMemo(() => {
    const params = new URLSearchParams({
      range: "all",
      date: activeDate,
      classLevel: filters.classLevel || "",
      subjectId: filters.subjectId || "",
      status: filters.status || "",
      ...Object.fromEntries(Object.entries(extraParams || {}).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")),
    });
    return params.toString();
  }, [activeDate, extraParams, filters.classLevel, filters.subjectId, filters.status]);

  useEffect(() => {
    calendarRef.current?.getApi?.().gotoDate?.(activeDate);
  }, [activeDate, view]);

  useEffect(() => {
    const api = calendarRef.current?.getApi?.();
    if (!api || !events.length) return;
    if (view !== "dayGridMonth") {
      const hasEventOnActiveDate = events.some((event) => String(event.start || "").slice(0, 10) === activeDate);
      const targetDate = hasEventOnActiveDate ? activeDate : firstEventDate || activeDate;
      if (targetDate) api.gotoDate?.(targetDate);
    }
  }, [activeDate, events, firstEventDate, view]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!apiUrl) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${apiUrl}?${query}`, { cache: "no-store" });
        const payload = isJsonResponse(response) ? await response.json() : { message: await response.text() };
        if (!response.ok) throw new Error(payload?.message || "Unable to load lectures.");
        if (ignore) return;
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        setEvents(
          rows.map((lecture) => {
            const displayStatus = lecture.display_status || getLectureDisplayStatus(lecture);
            const { start: activeStartValue, end: activeEndValue } = pickActiveTime(lecture);
            const startDate = parseDate(activeStartValue);
            const endDate = parseDate(activeEndValue);
            const startText = startDate ? new Date(startDate).toLocaleTimeString("en-PK", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "";
            const endText = endDate ? new Date(endDate).toLocaleTimeString("en-PK", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "";
            const palette = displayStatus === "live" ? ["#2563eb", "#1d4ed8"] : ["#75797D", "#666A6E"];
            return {
              id: lecture.id,
              title: `${startText}${endText ? ` - ${endText}` : ""}${lecture.subject_name ? ` ${lecture.subject_name}` : ""}`,
              start: startDate,
              end: endDate,
              backgroundColor: palette[0],
              borderColor: palette[1],
              textColor: displayStatus === "live" ? "#ffffff" : "#063F32",
              extendedProps: {
                lecture_id: lecture.id,
                title: lecture.title,
                subject_name: lecture.subject_name,
                teacher_name: lecture.teacher_name,
                scheduled_start: activeStartValue,
                scheduled_end: activeEndValue,
                display_status: displayStatus,
                status: lecture.status,
                google_meet_link: lecture.google_meet_link,
                can_join: canShowMeetLink(lecture),
                description: lecture.description,
                rescheduled_start: lecture.rescheduled_start || lecture.rescheduledStartTime || lecture.rescheduled_scheduled_start,
                rescheduled_end: lecture.rescheduled_end || lecture.rescheduledEndTime || lecture.rescheduled_scheduled_end,
              },
            };
          })
        );
      } catch (fetchError) {
        if (!ignore) setError(fetchError instanceof Error ? fetchError.message : "Unable to load lectures.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [apiUrl, query]);

  function handleEventClick(info) {
    const lecture = info.event.extendedProps || null;
    setSelected(lecture);
    onEventClick?.(lecture);
  }

  function handleDateClick(info) {
    onDateSelect?.(info.dateStr);
  }

  function changeView(nextView) {
    setView(nextView);
    const api = calendarRef.current?.getApi?.();
    const targetDate = nextView === "timeGridDay" ? firstEventDate || activeDate : activeDate;
    if (targetDate) api?.gotoDate?.(targetDate);
    api?.changeView(nextView);
  }

  return (
    <div className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 px-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="mt-0 text-xl font-semibold tracking-tight text-[#063F32]">{title || "Month, week and day view"}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["dayGridMonth", "Month"],
            ["timeGridWeek", "Week"],
            ["timeGridDay", "Day"],
          ].map(([nextView, label]) => (
            <button
              key={nextView}
              type="button"
              onClick={() => changeView(nextView)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                view === nextView
                  ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_10px_24px_-14px_rgba(201,162,39,0.5)]"
                  : "bg-white text-[#245C4F] hover:bg-[#F1EADC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-3">
          <FullCalendar
            key={view}
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            initialDate={activeDate}
            headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
            events={events}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            height="auto"
            nowIndicator
            selectable={false}
            editable={false}
            weekends
            timeZone={APP_TIMEZONE}
            eventDisplay="block"
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            loading={setLoading}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            eventClassNames={() => ["cursor-pointer"]}
            eventContent={(arg) => (
              <div className="overflow-hidden px-1 text-[11px] leading-tight text-white">
                <div className="truncate font-semibold">{arg.event.title}</div>
              </div>
            )}
          />
          {loading ? <p className="mt-3 text-sm text-[#245C4F]">Loading lectures...</p> : null}
        </div>

        <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Lecture details</p>
          {selected ? (
            <div className="mt-4 space-y-3 text-sm text-[#245C4F]">
              <p><strong className="text-[#063F32]">Title:</strong> {selected.title || "Not available"}</p>
              <p><strong className="text-[#063F32]">Subject:</strong> {selected.subject_name || "Not available"}</p>
              <p><strong className="text-[#063F32]">Teacher:</strong> {selected.teacher_name || "Not available"}</p>
              <p><strong className="text-[#063F32]">Start:</strong> {formatLocalDateTime(selected.scheduled_start)}</p>
              <p><strong className="text-[#063F32]">End:</strong> {formatLocalDateTime(selected.scheduled_end)}</p>
              <p><strong className="text-[#063F32]">Status:</strong> {selected.display_status || selected.status || "Not available"}</p>
              <p className="whitespace-pre-line"><strong className="text-[#063F32]">Description:</strong> {selected.description || "Not available"}</p>
              {selected.google_meet_link && canShowMeetLink(selected) ? (
                <a href={selected.google_meet_link} target="_blank" rel="noreferrer" className="inline-flex rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]">
                  Open Meet
                </a>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#245C4F]">Click a lecture to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
