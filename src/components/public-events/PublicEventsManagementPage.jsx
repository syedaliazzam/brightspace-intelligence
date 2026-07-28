"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Check, ChevronDown, ClipboardCopy, Eye, FileVideo, ImagePlus, RefreshCw, RotateCcw, Search } from "lucide-react";
import {
  cleanText,
  formatEventDate,
  formatEventDateTime,
  formatEventLifecycleLabel,
  formatEventLifecycleStatus,
  formatMoney,
} from "@/lib/publicEvents";

const EMPTY_FORM = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  eventFeeAmount: "",
  registrationDeadlineDate: "",
  registrationDeadlineTime: "",
  image: null,
};

function eventTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "current") return "bg-[#EEF4FF] text-[#1D4ED8]";
  return "bg-[#F1EADC] text-[#6B7280]";
}

function formatTimeOnly(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

const PUBLIC_EVENT_TABLE_COLUMNS = [
  { value: "all", label: "All columns" },
  { value: "title", label: "Event" },
  { value: "start_date", label: "Start date" },
  { value: "start_time", label: "Start time" },
  { value: "end_date", label: "End date" },
  { value: "end_time", label: "End time" },
  { value: "deadline_date", label: "Deadline date" },
  { value: "deadline_time", label: "Deadline time" },
  { value: "event_fee_amount", label: "Fee" },
  { value: "registration_count", label: "Registrations" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "publication", label: "Publication" },
  { value: "meet_link", label: "Meet link" },
  { value: "description", label: "Description" },
];

function getPublicEventColumnValue(item, column) {
  const lifecycle = formatEventLifecycleLabel(formatEventLifecycleStatus(item.start_at, item.end_at));
  const publication = String(item.publication_status || "draft").toLowerCase() === "published" ? "Published" : "Draft";

  switch (column) {
    case "title":
      return item.title;
    case "start_date":
      return formatEventDate(item.start_at);
    case "start_time":
      return formatTimeOnly(item.start_at);
    case "end_date":
      return formatEventDate(item.end_at);
    case "end_time":
      return formatTimeOnly(item.end_at);
    case "deadline_date":
      return formatEventDate(item.registration_deadline);
    case "deadline_time":
      return formatTimeOnly(item.registration_deadline);
    case "event_fee_amount":
      return String(item.event_fee_amount ?? "");
    case "registration_count":
      return String(item.registration_count ?? "");
    case "lifecycle":
      return lifecycle;
    case "publication":
      return publication;
    case "meet_link":
      return item.meet_link;
    case "description":
      return item.description;
    default:
      return "";
  }
}

function matchesPublicEventSearch(item, column, query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return true;

  if (column && column !== "all") {
    return String(getPublicEventColumnValue(item, column) || "").toLowerCase().includes(value);
  }

  return PUBLIC_EVENT_TABLE_COLUMNS
    .filter((columnItem) => columnItem.value !== "all")
    .some((columnItem) => String(getPublicEventColumnValue(item, columnItem.value) || "").toLowerCase().includes(value));
}

function canShowPublicEventRecordingSection(item) {
  const status = formatEventLifecycleStatus(item?.start_at, item?.end_at);
  return status === "current" || status === "past";
}

export default function PublicEventsManagementPage({
  portalLabel = "Coordinator portal",
  title = "Public events",
  description = "Create public events, review their publication state, and track the event lifecycle from one LMS page.",
  apiPath = "/api/coordinator/public-events",
  canManage = true,
  showRecords = true,
  showRecordingSync = false,
}) {
  const pageSize = 7;
  const calendarRef = useRef(null);
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [selected, setSelected] = useState(null);
  const [descriptionItem, setDescriptionItem] = useState(null);
  const [copiedMeetLink, setCopiedMeetLink] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [publicationLoadingId, setPublicationLoadingId] = useState("");
  const [syncingRecordingId, setSyncingRecordingId] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openFilterSelect, setOpenFilterSelect] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  const [tableFilters, setTableFilters] = useState({
    lifecycle: "all",
    publication: "all",
    column: "all",
    search: "",
  });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(apiPath, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load public events.");
      const nextItems = Array.isArray(data.items) ? data.items : [];
      setItems(nextItems);
      return nextItems;
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load public events.");
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const response = await fetch(apiPath, { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data?.message || "Unable to load public events.");
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (error) {
        if (!active) return;
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Unable to load public events.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      active = false;
    };
  }, [apiPath]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => () => {
    if (previewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(previewImage);
    }
  }, [previewImage]);

  useEffect(() => {
    if (!copiedMeetLink) return undefined;
    const timer = window.setTimeout(() => setCopiedMeetLink(""), 1800);
    return () => window.clearTimeout(timer);
  }, [copiedMeetLink]);

  const summary = useMemo(() => {
    const total = items.length;
    const published = items.filter((item) => String(item.publication_status || "").toLowerCase() === "published").length;
    const current = items.filter((item) => (item.lifecycle_status || formatEventLifecycleStatus(item.start_at, item.end_at)) === "current").length;
    const upcoming = items.filter((item) => (item.lifecycle_status || formatEventLifecycleStatus(item.start_at, item.end_at)) === "upcoming").length;
    return { total, published, current, upcoming };
  }, [items]);

  const calendarEvents = useMemo(
    () =>
      items.map((item) => {
        const lifecycle = formatEventLifecycleStatus(item.start_at, item.end_at);
        const colors =
          lifecycle === "current"
            ? { background: "#2563EB", border: "#1D4ED8" }
            : { background: "#6B7280", border: "#4B5563" };
        return {
          id: item.id,
          title: item.title,
          start: item.start_at,
          end: item.end_at,
          backgroundColor: colors.background,
          borderColor: colors.border,
          textColor: "#FFFFFF",
          extendedProps: item,
        };
      }),
    [items]
  );

  const filteredTableItems = useMemo(() => {
    return items.filter((item) => {
      const lifecycle = formatEventLifecycleStatus(item.start_at, item.end_at);
      const publication = String(item.publication_status || "draft").toLowerCase();

      if (tableFilters.lifecycle !== "all" && lifecycle !== tableFilters.lifecycle) return false;
      if (tableFilters.publication !== "all" && publication !== tableFilters.publication) return false;

      return matchesPublicEventSearch(item, tableFilters.column, tableFilters.search);
    });
  }, [items, tableFilters]);

  const totalRecordPages = Math.max(1, Math.ceil(filteredTableItems.length / pageSize));
  const safeRecordsPage = Math.min(recordsPage, totalRecordPages);
  const paginatedTableItems = useMemo(() => {
    const startIndex = (safeRecordsPage - 1) * pageSize;
    return filteredTableItems.slice(startIndex, startIndex + pageSize);
  }, [filteredTableItems, safeRecordsPage, pageSize]);

  useEffect(() => {
    setRecordsPage(1);
  }, [tableFilters]);

  useEffect(() => {
    if (recordsPage > totalRecordPages) {
      setRecordsPage(totalRecordPages);
    }
  }, [recordsPage, totalRecordPages]);

  function resetTableFilters() {
    setRecordsPage(1);
    setTableFilters({
      lifecycle: "all",
      publication: "all",
      column: "all",
      search: "",
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = new FormData();
      payload.set("title", form.title);
      payload.set("description", form.description);
      payload.set("startDate", form.startDate);
      payload.set("endDate", form.endDate);
      payload.set("startTime", form.startTime);
      payload.set("endTime", form.endTime);
      payload.set("eventFeeAmount", form.eventFeeAmount);
      payload.set("registrationDeadlineDate", form.registrationDeadlineDate || form.startDate);
      payload.set("registrationDeadlineTime", form.registrationDeadlineTime || form.startTime);
      if (form.image instanceof File) {
        payload.set("image", form.image);
      }

      const response = await fetch("/api/coordinator/public-events", {
        method: "POST",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to create public event.");

      setTone("success");
      setMessage(data?.message || "Public event created successfully.");
      setForm(EMPTY_FORM);
      formRef.current?.reset();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFormResetKey((current) => current + 1);
      if (previewImage?.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage);
      }
      setPreviewImage("");
      setOpenCreateModal(false);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to create public event.");
    } finally {
      setSubmitting(false);
    }
  }

  async function togglePublication(item) {
    const current = String(item.publication_status || "").toLowerCase();
    const next = current === "published" ? "draft" : "published";
    setPublicationLoadingId(item.id);

    try {
      const response = await fetch(`/api/coordinator/public-events/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicationStatus: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update publication status.");
      setTone("success");
      setMessage(`Event moved to ${next === "published" ? "published" : "draft"} successfully.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update publication status.");
    } finally {
      setPublicationLoadingId("");
    }
  }

  async function copyMeetLink(meetLink) {
    const value = String(meetLink || "").trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setTone("success");
      setMessage("Meet link copied.");
      setCopiedMeetLink(value);
    } catch {
      setTone("error");
      setMessage("Unable to copy meet link.");
    }
  }

  async function handleSyncRecording() {
    if (!selected?.id) return;

    setSyncingRecordingId(selected.id);
    try {
      const response = await fetch(`/api/coordinator/public-events/${encodeURIComponent(selected.id)}/recording-sync`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to sync recording.");

      const recordingUrl = data.recording_drive_url || "";
      setTone("success");
      setMessage(data?.message || "Recording sync checked.");
      const refreshedItems = await load();
      setSelected((current) => {
        if (!current) return current;
        const refreshedItem = refreshedItems.find((item) => item.id === current.id);
        if (refreshedItem) {
          return refreshedItem;
        }
        return {
          ...current,
          recording_drive_url: recordingUrl || current.recording_drive_url,
          recording_synced_at: new Date().toISOString(),
          google_calendar_last_error: "",
        };
      });
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to sync recording.");
    } finally {
      setSyncingRecordingId("");
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        {message ? (
          <div className={`fixed right-4 top-4 z-[10000] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(13,59,46,0.45)] ${tone === "success" ? "border-[#2D8A6A]/25 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]" : "border-rose-200 bg-white text-rose-700"}`}>
            {message}
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setOpenCreateModal(true)}
                  className="rounded-2xl bg-[#FFF5D6] px-4 py-3 text-sm font-semibold text-[#0D5C48] transition hover:bg-white"
                >
                  Create Public Event
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                  <p className="font-semibold">{summary.total}</p>
                  <p className="text-xs text-[#EAF6EF]">Events</p>
                </div>
                <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                  <p className="font-semibold">{summary.published}</p>
                  <p className="text-xs text-[#EAF6EF]">Published</p>
                </div>
                <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                  <p className="font-semibold">{summary.current}</p>
                  <p className="text-xs text-[#EAF6EF]">Current</p>
                </div>
                <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                  <p className="font-semibold">{summary.upcoming}</p>
                  <p className="text-xs text-[#EAF6EF]">Upcoming</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-3 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <style jsx global>{`
            .public-events-calendar .fc-timegrid-slot-lane.fc-slot-half-hour,
            .public-events-calendar .fc-timegrid-slot-label.fc-slot-half-hour {
              border-top-color: transparent !important;
              box-shadow: none !important;
              background-image: none !important;
            }

            .public-events-calendar .fc-timegrid-slot.fc-slot-half-hour {
              border-top-color: transparent !important;
              box-shadow: none !important;
              background-image: none !important;
            }
          `}</style>
          <div className="public-events-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridWeek,dayGridMonth" }}
            events={calendarEvents}
            eventClick={(info) => setSelected(info.event.extendedProps)}
            slotLaneClassNames={(arg) => (arg.date.getMinutes() === 30 ? ["fc-slot-half-hour"] : [])}
            slotLabelClassNames={(arg) => (arg.date.getMinutes() === 30 ? ["fc-slot-half-hour"] : [])}
            slotLaneDidMount={(arg) => {
              if (arg.date.getMinutes() !== 30) return;
              arg.el.style.borderTopColor = "transparent";
              arg.el.style.backgroundImage = "none";
              arg.el.style.boxShadow = "none";
            }}
            slotLabelDidMount={(arg) => {
              if (arg.date.getMinutes() !== 30) return;
              arg.el.style.borderTopColor = "transparent";
              arg.el.style.backgroundImage = "none";
              arg.el.style.boxShadow = "none";
            }}
            eventContent={(arg) => (
              <div className="cursor-pointer overflow-hidden rounded-md px-1.5 py-1 text-white">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold leading-none">
                  <span className="shrink-0 opacity-95">
                    {arg.timeText || formatTimeOnly(arg.event.start)}
                  </span>
                  <span className="truncate font-medium opacity-100">
                    {arg.event.title}
                  </span>
                </div>
              </div>
            )}
            height="auto"
            editable={false}
            selectable={false}
            weekends
            eventDisplay="block"
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", hour12: true }}
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            slotMinTime="08:00:00"
            slotMaxTime="18:00:00"
            scrollTime="08:00:00"
            allDaySlot={false}
          />
          </div>
          {loading ? <p className="mt-3 px-2 text-sm text-[#245C4F]">Loading public events...</p> : null}
          {selected ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[2rem] bg-[#063F32]/35 px-4 py-6 backdrop-blur-sm">
              <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Public event details</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.title}</h2>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
                </div>
                <div className="max-h-[58vh] space-y-4 overflow-y-auto p-5 text-sm text-[#245C4F] sm:p-6">
                  {selected.image_url ? (
                    <div className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/10 bg-white">
                      <img src={selected.image_url} alt={selected.title} className="h-32 w-full object-cover sm:h-36" />
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Start</p>
                      <p className="mt-1">{formatEventDateTime(selected.start_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">End</p>
                      <p className="mt-1">{formatEventDateTime(selected.end_at)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Registration deadline</p>
                      <p className="mt-1">{formatEventDateTime(selected.registration_deadline)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Event fee</p>
                      <p className="mt-1">{formatMoney(selected.event_fee_amount)}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Lifecycle</p>
                      <p className="mt-1">{formatEventLifecycleLabel(formatEventLifecycleStatus(selected.start_at, selected.end_at))}</p>
                    </div>
                    <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Publication</p>
                      <p className="mt-1">{String(selected.publication_status || "draft").toLowerCase() === "published" ? "Published" : "Draft"}</p>
                    </div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Description</p>
                    <p className="mt-2 whitespace-pre-line">{selected.description || "-"}</p>
                  </div>
                    <div className="col-span-2 rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Meet link</p>
                      <p className="mt-2 break-all text-sm text-[#245C4F]">{selected.meet_link || "Not provided"}</p>
                      {selected.meet_link ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a
                            href={selected.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-xs font-semibold text-[#FFF5D6]"
                          >
                            Open link
                          </a>
                          <button
                            type="button"
                            onClick={() => copyMeetLink(selected.meet_link)}
                            className="inline-flex items-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#0D5C48]"
                          >
                            {copiedMeetLink === selected.meet_link ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                            {copiedMeetLink === selected.meet_link ? "Copied" : "Copy"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {selected.google_calendar_last_error ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                      {selected.google_calendar_last_error}
                    </div>
                  ) : null}
                  {canShowPublicEventRecordingSection(selected) ? (
                    <div className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C9A227]">Recording</p>
                          <p className="mt-1 text-[#245C4F]">
                            {selected.recording_drive_url ? "Recording is available." : "Recording appears after Google finishes processing it."}
                          </p>
                        </div>
                        {showRecordingSync ? (
                          <button
                            type="button"
                            onClick={handleSyncRecording}
                            disabled={syncingRecordingId === selected.id}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#0D5C48] disabled:opacity-70"
                          >
                            <RefreshCw className={`h-4 w-4 ${syncingRecordingId === selected.id ? "animate-spin" : ""}`} />
                            Sync Recording
                          </button>
                        ) : null}
                      </div>
                      {selected.recording_drive_url ? (
                        <a
                          href={selected.recording_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-4 py-2 text-sm font-semibold text-[#FFF5D6]"
                        >
                          <FileVideo className="h-4 w-4" />
                          Open Recording
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {showRecords ? (
          <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
            <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
              <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Public event records</p>
            </div>
            <div className="grid gap-4 border-b border-[#2D8A6A]/10 px-6 py-5 lg:grid-cols-[180px_180px_240px_minmax(280px,1fr)_170px]">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Events</span>
                <div className="relative">
                  <select
                    value={tableFilters.lifecycle}
                    onFocus={() => setOpenFilterSelect("lifecycle")}
                    onBlur={() => setOpenFilterSelect("")}
                    onChange={(event) => {
                      setOpenFilterSelect("");
                      setTableFilters((current) => ({ ...current, lifecycle: event.target.value }));
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                  >
                    <option value="all">All Events</option>
                    <option value="upcoming">Upcoming Events</option>
                    <option value="current">Current Events</option>
                    <option value="past">Past Events</option>
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "lifecycle" ? "rotate-180" : ""}`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Publication</span>
                <div className="relative">
                  <select
                    value={tableFilters.publication}
                    onFocus={() => setOpenFilterSelect("publication")}
                    onBlur={() => setOpenFilterSelect("")}
                    onChange={(event) => {
                      setOpenFilterSelect("");
                      setTableFilters((current) => ({ ...current, publication: event.target.value }));
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                  >
                    <option value="all">All publication</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "publication" ? "rotate-180" : ""}`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Column</span>
                <div className="relative">
                  <select
                    value={tableFilters.column}
                    onFocus={() => setOpenFilterSelect("column")}
                    onBlur={() => setOpenFilterSelect("")}
                    onChange={(event) => {
                      setOpenFilterSelect("");
                      setTableFilters((current) => ({ ...current, column: event.target.value }));
                    }}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                  >
                    {PUBLIC_EVENT_TABLE_COLUMNS.map((column) => (
                      <option key={column.value} value={column.value}>{column.label}</option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "column" ? "rotate-180" : ""}`} />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
                  <input
                    value={tableFilters.search}
                    onChange={(event) => setTableFilters((current) => ({ ...current, search: event.target.value }))}
                    placeholder="Search in selected column"
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                  />
                </div>
              </label>
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={resetTableFilters}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
            <div className="border-b border-[#2D8A6A]/10 px-6 py-4 text-right text-sm font-semibold text-[#245C4F]">
              Showing {filteredTableItems.length === 0 ? 0 : (safeRecordsPage - 1) * pageSize + 1}-{Math.min(safeRecordsPage * pageSize, filteredTableItems.length)} of {filteredTableItems.length}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1700px] text-left text-sm">
                <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr>
                    <th className="min-w-[220px] whitespace-nowrap px-6 py-4">Event</th>
                    <th className="min-w-[140px] whitespace-nowrap px-6 py-4">Start Date</th>
                    <th className="min-w-[120px] whitespace-nowrap px-6 py-4">Start Time</th>
                    <th className="min-w-[140px] whitespace-nowrap px-6 py-4">End Date</th>
                    <th className="min-w-[120px] whitespace-nowrap px-6 py-4">End Time</th>
                    <th className="min-w-[150px] whitespace-nowrap px-6 py-4">Deadline Date</th>
                    <th className="min-w-[130px] whitespace-nowrap px-6 py-4">Deadline Time</th>
                    <th className="min-w-[120px] whitespace-nowrap px-6 py-4">Fee</th>
                    <th className="min-w-[130px] whitespace-nowrap px-6 py-4">Registrations</th>
                    <th className="min-w-[130px] whitespace-nowrap px-6 py-4">Lifecycle</th>
                    <th className="min-w-[130px] whitespace-nowrap px-6 py-4">Publication</th>
                    <th className="min-w-[220px] whitespace-nowrap px-6 py-4">Meet Link</th>
                    <th className="min-w-[140px] whitespace-nowrap px-6 py-4">Description</th>
                    <th className="min-w-[170px] whitespace-nowrap px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EADC]">
                  {paginatedTableItems.length ? paginatedTableItems.map((item) => {
                    const lifecycle = formatEventLifecycleStatus(item.start_at, item.end_at);
                    const publication = String(item.publication_status || "draft").toLowerCase();
                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-[#063F32]">{item.title}</p>
                        </td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatEventDate(item.start_at)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatTimeOnly(item.start_at)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatEventDate(item.end_at)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatTimeOnly(item.end_at)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatEventDate(item.registration_deadline)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatTimeOnly(item.registration_deadline)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.event_fee_amount)}</td>
                        <td className="px-6 py-4 text-[#245C4F]">{item.registration_count || 0}</td>
                        <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${eventTone(lifecycle)}`}>{formatEventLifecycleLabel(lifecycle)}</span></td>
                        <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${publication === "published" ? "bg-[#EAF6EF] text-[#0D5C48]" : "bg-[#F1EADC] text-[#7A5E2B]"}`}>{publication === "published" ? "Published" : "Draft"}</span></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <a
                              href={item.meet_link || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`min-w-0 max-w-[160px] truncate rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold ${item.meet_link ? "text-[#063F32] transition hover:bg-[#F1EADC]" : "pointer-events-none text-[#9CA3AF]"}`}
                              title={item.meet_link || "Not provided"}
                            >
                              {item.meet_link || "Not provided"}
                            </a>
                            {item.meet_link ? (
                              <button
                                type="button"
                                onClick={() => copyMeetLink(item.meet_link)}
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2D8A6A]/20 bg-white text-[#0D5C48] transition hover:bg-[#F1EADC]"
                                aria-label="Copy meet link"
                              >
                                {copiedMeetLink === item.meet_link ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button type="button" onClick={() => setDescriptionItem(item)} className="whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                            View Msg
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-nowrap gap-2">
                            <button type="button" onClick={() => setSelected(item)} className="whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                              <span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> View</span>
                            </button>
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => togglePublication(item)}
                                disabled={publicationLoadingId === item.id}
                                className="whitespace-nowrap rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70"
                              >
                                {publicationLoadingId === item.id ? "Updating..." : publication === "published" ? "Move to Draft" : "Publish"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={14} className="px-6 py-10 text-center text-[#245C4F]">No public events matched the current filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredTableItems.length > pageSize ? (
              <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#245C4F]">
                  Page {safeRecordsPage} of {totalRecordPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRecordsPage((current) => Math.max(1, current - 1))}
                    disabled={safeRecordsPage === 1}
                    className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecordsPage((current) => Math.min(totalRecordPages, current + 1))}
                    disabled={safeRecordsPage === totalRecordPages}
                    className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
            {descriptionItem ? (
              <div className="absolute inset-4 z-20 flex items-center justify-center rounded-[1.75rem] bg-[#063F32]/35 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Event description</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{descriptionItem.title}</h2>
                    </div>
                    <button type="button" onClick={() => setDescriptionItem(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
                  </div>
                  <div className="p-6 text-sm text-[#245C4F]">
                    <p className="whitespace-pre-line">{descriptionItem.description || "-"}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {canManage && openCreateModal ? (
          <div className="fixed inset-0 z-[10020] flex items-start justify-center bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
            <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Public event</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Create public event</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenCreateModal(false)}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto p-6">
                <form key={formResetKey} ref={formRef} className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event name</span>
                    <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event fee</span>
                    <input type="number" min="0" step="0.01" value={form.eventFeeAmount} onChange={(event) => setForm((current) => ({ ...current, eventFeeAmount: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start date</span>
                    <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End date</span>
                    <input type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start time</span>
                    <input type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End time</span>
                    <input type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Registration deadline date</span>
                    <input type="date" value={form.registrationDeadlineDate} onChange={(event) => setForm((current) => ({ ...current, registrationDeadlineDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Registration deadline time</span>
                    <input type="time" value={form.registrationDeadlineTime} onChange={(event) => setForm((current) => ({ ...current, registrationDeadlineTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Description</span>
                    <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event image</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setForm((current) => ({ ...current, image: file }));
                        if (previewImage?.startsWith("blob:")) URL.revokeObjectURL(previewImage);
                        setPreviewImage(file ? URL.createObjectURL(file) : "");
                      }}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0]"
                      required
                    />
                  </label>
                  {previewImage ? (
                    <div className="md:col-span-2 overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
                      <img src={previewImage} alt="Event preview" className="h-60 w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-5 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_16px_34px_-24px_rgba(13,59,46,0.65)] disabled:opacity-70">
                      {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      {submitting ? "Creating..." : "Create Public Event"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenCreateModal(false)}
                      className="inline-flex items-center rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#063F32]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

