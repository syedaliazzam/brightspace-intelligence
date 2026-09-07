"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ClipboardCopy, Eye, FileVideo, ImagePlus, Pencil, Plus, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import {
  cleanText,
  formatEventDate,
  formatEventDateTime,
  formatEventLifecycleLabel,
  formatEventLifecycleStatus,
  formatMoney,
} from "@/lib/publicEvents";

const EVENT_CATEGORIES = [
  { id: "alh-students", label: "Ashshajrah Students" },
  { id: "alh-parents", label: "Ashshajrah Parents" },
  { id: "general-students", label: "General Students" },
  { id: "general-parents", label: "General Parents" },
];

const EMPTY_FORM = {
  eventCategory: "",
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
  registrationFormSchema: [],
};

const SYSTEM_REGISTRATION_FIELDS = [
  { id: "email", label: "Email", type: "email", required: true, system: true },
  { id: "whatsapp", label: "WhatsApp number", type: "tel", required: true, system: true },
  { id: "studentName", label: "Student name", type: "text", system: true },
  { id: "parentName", label: "Parent / guardian name", type: "text", system: true },
  { id: "studentNames", label: "Students", type: "repeatable-text", system: true },
  { id: "schoolName", label: "School name", type: "text", system: true },
  { id: "className", label: "Class", type: "text", system: true },
  { id: "notes", label: "Additional notes", type: "textarea", system: true },
];

function normalizeRegistrationField(field, index) {
  const rawType = String(field.type || "text").toLowerCase();
  const fieldType = { int: "number", integer: "number", float: "number", phone: "tel", long_text: "textarea" }[rawType] || rawType;
  return {
    id: String(field.id || `custom-${Date.now()}-${index}`),
    label: String(field.label || "Custom field").trim(),
    type: ["text", "email", "tel", "number", "date", "textarea", "repeatable-text"].includes(fieldType) ? fieldType : "text",
    required: Boolean(field.required),
    placeholder: String(field.placeholder || ""),
    helperText: String(field.helperText || ""),
    enabled: field.enabled !== false,
    system: Boolean(field.system),
  };
}

function parseRegistrationFormSchema(value) {
  const normalize = (fields) => fields.map((field) => {
    const rawType = String(field.type || "text").toLowerCase();
    return {
      ...field,
      type: { int: "number", integer: "number", float: "number", phone: "tel", long_text: "textarea" }[rawType] || rawType,
    };
  });
  if (Array.isArray(value)) return normalize(value);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalize(parsed) : [];
  } catch {
    return [];
  }
}

function RegistrationFormBuilder({ value, onChange, category }) {
  const [search, setSearch] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [newField, setNewField] = useState(null);
  const selected = Array.isArray(value) ? value : [];
  const selectedIds = new Set(selected.map((field) => field.id));
  const available = SYSTEM_REGISTRATION_FIELDS.filter((field) => !selectedIds.has(field.id) && field.label.toLowerCase().includes(search.toLowerCase()));
  const addField = (field) => onChange([...selected, normalizeRegistrationField(field, selected.length)]);
  const addCustom = () => setNewField({ label: "", type: "text", required: false, placeholder: "", helperText: "", defaultValue: "" });
  const updateField = (id, changes) => onChange(selected.map((field) => field.id === id ? { ...field, ...changes } : field));
  const removeField = (id) => onChange(selected.filter((field) => field.id !== id));
  const moveField = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= selected.length) return;
    const next = [...selected];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <div className="md:col-span-2 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#F7F2E8] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">Registration form builder</p><p className="mt-1 text-sm text-[#245C4F]">Choose existing fields or add fields for this event.</p></div>
        <button type="button" onClick={addCustom} className="rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FFF5D6]">Add new field</button>
      </div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search existing fields" className="mt-4 w-full rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm text-[#063F32] outline-none" />
      <div className="mt-4 rounded-xl border border-[#2D8A6A]/10 bg-white/70 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Available fields</p>
        <div className="mt-3 flex flex-wrap gap-2">
        {available.map((field) => <button key={field.id} type="button" onClick={() => addField(field)} className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-xs font-semibold text-[#0D5C48]">+ {field.label}</button>)}
        {!available.length ? <span className="text-xs text-[#6B7280]">All matching fields are selected.</span> : null}
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-[#2D8A6A]/10 bg-white/70 p-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Selected fields</p>
        <div className="mt-3 space-y-2">
        {selected.map((field, index) => (
          <div key={field.id} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData("text/plain")); if (!Number.isInteger(from) || from === index) return; const next = [...selected]; const [moved] = next.splice(from, 1); next.splice(index, 0, moved); onChange(next); }} className="rounded-xl border border-[#2D8A6A]/15 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2"><input value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} className="min-w-[180px] flex-1 rounded-lg border border-[#2D8A6A]/15 px-2 py-1 text-xs font-bold text-[#0D5C48]" /><span className="text-[10px] uppercase tracking-wide text-[#6B7280]">{field.type}</span><label className="ml-auto flex items-center gap-1 text-xs text-[#245C4F]"><input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} /> Required</label><label className="flex items-center gap-1 text-xs text-[#245C4F]"><input type="checkbox" checked={field.enabled !== false} onChange={(event) => updateField(field.id, { enabled: event.target.checked })} /> Enabled</label><button type="button" aria-label="Move field up" onClick={() => moveField(index, -1)} disabled={index === 0} className="rounded-md p-1 text-[#0D5C48] disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button><button type="button" aria-label="Move field down" onClick={() => moveField(index, 1)} disabled={index === selected.length - 1} className="rounded-md p-1 text-[#0D5C48] disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button><button type="button" onClick={() => removeField(field.id)} className="text-xs font-semibold text-rose-700">Remove</button></div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3"><input value={field.placeholder || ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value })} placeholder="Placeholder text" className="rounded-lg border border-[#2D8A6A]/15 px-2 py-1 text-xs" /><input value={field.helperText || ""} onChange={(event) => updateField(field.id, { helperText: event.target.value })} placeholder="Help text" className="rounded-lg border border-[#2D8A6A]/15 px-2 py-1 text-xs" /><input value={field.defaultValue || ""} onChange={(event) => updateField(field.id, { defaultValue: event.target.value })} placeholder="Default value" className="rounded-lg border border-[#2D8A6A]/15 px-2 py-1 text-xs" /></div>
          </div>
        ))}
        {!selected.length ? <p className="rounded-lg border border-dashed border-[#2D8A6A]/20 px-3 py-4 text-xs text-[#6B7280]">No fields selected yet.</p> : null}
        </div>
      </div>
      {newField ? <div className="mt-4 rounded-xl border border-[#E4C766]/50 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Add new field</p><button type="button" onClick={() => setNewField(null)} aria-label="Close add field" className="text-[#0D5C48]"><X className="h-4 w-4" /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input autoFocus value={newField.label} onChange={(event) => setNewField((current) => ({ ...current, label: event.target.value }))} placeholder="Field label" className="rounded-lg border border-[#2D8A6A]/15 px-3 py-2 text-sm" /><select value={newField.type} onChange={(event) => setNewField((current) => ({ ...current, type: event.target.value }))} className="rounded-lg border border-[#2D8A6A]/15 px-3 py-2 text-sm"><option value="text">Short text</option><option value="textarea">Long text</option><option value="email">Email</option><option value="tel">Phone</option><option value="number">Number</option><option value="date">Date</option></select><input value={newField.placeholder} onChange={(event) => setNewField((current) => ({ ...current, placeholder: event.target.value }))} placeholder="Placeholder text" className="rounded-lg border border-[#2D8A6A]/15 px-3 py-2 text-sm" /><input value={newField.helperText} onChange={(event) => setNewField((current) => ({ ...current, helperText: event.target.value }))} placeholder="Help text" className="rounded-lg border border-[#2D8A6A]/15 px-3 py-2 text-sm" /><input value={newField.defaultValue} onChange={(event) => setNewField((current) => ({ ...current, defaultValue: event.target.value }))} placeholder="Default value" className="rounded-lg border border-[#2D8A6A]/15 px-3 py-2 text-sm" /><label className="flex items-center gap-2 text-sm text-[#245C4F]"><input type="checkbox" checked={newField.required} onChange={(event) => setNewField((current) => ({ ...current, required: event.target.checked }))} /> Required field</label></div><button type="button" onClick={() => { if (!newField.label.trim()) return; addField({ ...newField, id: `custom-${Date.now()}`, system: false }); setNewField(null); }} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FFF5D6]"><Plus className="h-3.5 w-3.5" /> Add field</button></div> : null}
      <div className="mt-5 rounded-[1.25rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">Live preview</p><p className="mt-1 text-xs text-[#245C4F]">{category ? `${category} registration form` : "Registration form"}</p></div>
          <div className="flex gap-1 rounded-full border border-[#2D8A6A]/15 bg-white p-1">
            {["desktop", "tablet", "mobile"].map((mode) => <button key={mode} type="button" onClick={() => setPreviewMode(mode)} className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${previewMode === mode ? "bg-[#0D5C48] text-[#FFF5D6]" : "text-[#0D5C48]"}`}>{mode}</button>)}
          </div>
        </div>
        <div className={`mx-auto mt-3 rounded-xl border border-[#2D8A6A]/15 bg-white p-4 transition-all ${previewMode === "mobile" ? "max-w-[220px]" : previewMode === "tablet" ? "max-w-[420px]" : "max-w-full"}`}>
          <p className="text-sm font-semibold text-[#063F32]">Event registration</p>
          <div className="mt-3 space-y-2">
            {selected.filter((field) => field.enabled !== false).map((field) => <div key={field.id} className="rounded-lg border border-[#2D8A6A]/10 bg-[#FAF7F0] px-3 py-2 text-xs text-[#245C4F]"><span className="font-semibold text-[#063F32]">{field.label}{field.required ? " *" : ""}</span>{field.type === "textarea" ? <div className="mt-1 min-h-12 rounded border border-[#2D8A6A]/10 bg-white px-2 py-2 text-[#8A9B94]">{field.defaultValue || field.placeholder || "Enter your response"}</div> : <div className={`mt-1 rounded border border-[#2D8A6A]/10 bg-white px-2 py-2 ${field.defaultValue ? "text-[#245C4F]" : "text-[#8A9B94]"}`}>{field.defaultValue || field.placeholder || "Enter your response"}</div>}{field.helperText ? <p className="mt-1 text-[10px] text-[#6B7280]">{field.helperText}</p> : null}</div>)}
            {!selected.some((field) => field.enabled !== false) ? <p className="text-xs text-[#6B7280]">Select fields to preview the form.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

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

const pakistanInputFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function getPakistanInputParts(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    pakistanInputFormatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

const PUBLIC_EVENT_TABLE_COLUMNS = [
  { value: "all", label: "All columns" },
  { value: "title", label: "Event" },
  { value: "event_category", label: "Category" },
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
  const categoryLabel = EVENT_CATEGORIES.find((c) => c.id === item.event_category)?.label || item.event_category || "";

  switch (column) {
    case "title":
      return item.title;
    case "event_category":
      return categoryLabel;
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
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [selected, setSelected] = useState(null);
  const [descriptionItem, setDescriptionItem] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [copiedMeetLink, setCopiedMeetLink] = useState("");
  const [previewImage, setPreviewImage] = useState("");
  const [editPreviewImage, setEditPreviewImage] = useState("");
  const [publicationLoadingId, setPublicationLoadingId] = useState("");
  const [syncingRecordingId, setSyncingRecordingId] = useState("");
  const [formResetKey, setFormResetKey] = useState(0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openFilterSelect, setOpenFilterSelect] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);
  const [tableFilters, setTableFilters] = useState({
    lifecycle: "all",
    publication: "all",
    column: "all",
    search: "",
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editCategoryOpen, setEditCategoryOpen] = useState(false);

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

  useEffect(() => () => {
    if (editPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(editPreviewImage);
    }
  }, [editPreviewImage]);

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
  const safeRecordsPage = Math.min(Math.max(1, recordsPage), totalRecordPages);
  const paginatedTableItems = useMemo(() => {
    const startIndex = (safeRecordsPage - 1) * pageSize;
    return filteredTableItems.slice(startIndex, startIndex + pageSize);
  }, [filteredTableItems, safeRecordsPage, pageSize]);

  function updateTableFilters(nextState) {
    setRecordsPage(1);
    setTableFilters(nextState);
  }

  function resetTableFilters() {
    setRecordsPage(1);
    setTableFilters({
      lifecycle: "all",
      publication: "all",
      column: "all",
      search: "",
    });
  }

  function closeEditModal() {
    if (editPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(editPreviewImage);
    }
    setEditingItem(null);
    setEditForm(EMPTY_FORM);
    setEditPreviewImage("");
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  }

  function openEditModal(item) {
    const start = getPakistanInputParts(item.start_at) || {};
    const end = getPakistanInputParts(item.end_at) || {};
    const deadline = getPakistanInputParts(item.registration_deadline) || start;

    if (editPreviewImage?.startsWith("blob:")) {
      URL.revokeObjectURL(editPreviewImage);
    }

    setEditingItem(item);
    setEditForm({
      eventCategory: item.event_category || "",
      title: item.title || "",
      description: item.description || "",
      startDate: start.date || "",
      endDate: end.date || "",
      startTime: start.time || "",
      endTime: end.time || "",
      eventFeeAmount: item.event_fee_amount ?? "",
      registrationDeadlineDate: deadline.date || "",
      registrationDeadlineTime: deadline.time || "",
      image: null,
      registrationFormSchema: parseRegistrationFormSchema(item.registration_form_schema),
    });
    setEditPreviewImage(item.image_url || "");
    if (editFileInputRef.current) {
      editFileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = new FormData();
      payload.set("eventCategory", form.eventCategory);
      payload.set("title", form.title);
      payload.set("description", form.description);
      payload.set("startDate", form.startDate);
      payload.set("endDate", form.endDate);
      payload.set("startTime", form.startTime);
      payload.set("endTime", form.endTime);
      payload.set("eventFeeAmount", form.eventFeeAmount);
      payload.set("registrationDeadlineDate", form.registrationDeadlineDate || form.startDate);
      payload.set("registrationDeadlineTime", form.registrationDeadlineTime || form.startTime);
      payload.set("registrationFormSchema", JSON.stringify(form.registrationFormSchema || []));
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

  async function handleEditSubmit(event) {
    event.preventDefault();
    if (!editingItem?.id) return;

    setEditSubmitting(true);
    setMessage("");

    try {
      const payload = new FormData();
      payload.set("eventCategory", editForm.eventCategory);
      payload.set("title", editForm.title);
      payload.set("description", editForm.description);
      payload.set("startDate", editForm.startDate);
      payload.set("endDate", editForm.endDate);
      payload.set("startTime", editForm.startTime);
      payload.set("endTime", editForm.endTime);
      payload.set("eventFeeAmount", editForm.eventFeeAmount);
      payload.set("registrationDeadlineDate", editForm.registrationDeadlineDate || editForm.startDate);
      payload.set("registrationDeadlineTime", editForm.registrationDeadlineTime || editForm.startTime);
      payload.set("registrationFormSchema", JSON.stringify(editForm.registrationFormSchema || []));
      if (editForm.image instanceof File) {
        payload.set("image", editForm.image);
      }

      const response = await fetch(`${apiPath}/${encodeURIComponent(editingItem.id)}`, {
        method: "PATCH",
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update public event.");

      setTone("success");
      setMessage(data?.message || "Public event updated successfully.");
      closeEditModal();
      const refreshedItems = await load();
      setSelected((current) => {
        if (!current) return current;
        return refreshedItems.find((item) => item.id === current.id) || current;
      });
      setDescriptionItem((current) => {
        if (!current) return current;
        return refreshedItems.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update public event.");
    } finally {
      setEditSubmitting(false);
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

        {selected ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-8 backdrop-blur-sm">
            <div className="w-full min-w-0 max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Public event details</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.title}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto p-5 text-sm text-[#245C4F] sm:p-6">
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
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Category</p>
                    <p className="mt-1">{EVENT_CATEGORIES.find((c) => c.id === selected.event_category)?.label || selected.event_category || "-"}</p>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
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
                      updateTableFilters({ ...tableFilters, lifecycle: event.target.value });
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
                      updateTableFilters({ ...tableFilters, publication: event.target.value });
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
                      updateTableFilters({ ...tableFilters, column: event.target.value });
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
                    onChange={(event) => updateTableFilters({ ...tableFilters, search: event.target.value })}
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
                    <th className="min-w-[260px] whitespace-nowrap px-6 py-4">Actions</th>
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
                              <button type="button" onClick={() => openEditModal(item)} className="whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                                <span className="inline-flex items-center gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</span>
                              </button>
                            ) : null}
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
              <div className="absolute inset-0 z-20 flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-8 backdrop-blur-sm">
                <div className="w-full min-w-0 max-w-2xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Event description</p>
                      <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{descriptionItem.title}</h2>
                    </div>
                    <button type="button" onClick={() => setDescriptionItem(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
                  </div>
                  <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-6 text-sm text-[#245C4F]">
                    <p className="whitespace-pre-line">{descriptionItem.description || "-"}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {canManage && editingItem ? (
          <div className="fixed inset-0 z-[10020] flex items-start justify-center bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
            <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Public event</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">Edit public event</h2>
                </div>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[80vh] overflow-y-auto p-6">
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEditSubmit}>
                  <RegistrationFormBuilder category={editForm.eventCategory} value={editForm.registrationFormSchema} onChange={(registrationFormSchema) => setEditForm((current) => ({ ...current, registrationFormSchema }))} />
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Select Event Category</span>
                    <div className="relative">
                      <select
                        value={editForm.eventCategory}
                        onChange={(event) => setEditForm((current) => ({ ...current, eventCategory: event.target.value }))}
                        onFocus={() => setEditCategoryOpen(true)}
                        onBlur={() => setEditCategoryOpen(false)}
                        className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                        required
                      >
                        <option value="">Select a category</option>
                        {EVENT_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#245C4F] transition-transform ${
                          editCategoryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </label>
                  <div className="md:col-span-2 rounded-xl border border-[#E4C766]/40 bg-[#FFF5D6]/45 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0D5C48]">Event details</p><p className="mt-1 text-xs text-[#245C4F]">Set the information and schedule for this public event.</p></div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event name</span>
                    <input value={editForm.title} onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Event fee</span>
                    <input type="number" min="0" step="0.01" value={editForm.eventFeeAmount} onChange={(event) => setEditForm((current) => ({ ...current, eventFeeAmount: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start date</span>
                    <input type="date" value={editForm.startDate} onChange={(event) => setEditForm((current) => ({ ...current, startDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End date</span>
                    <input type="date" value={editForm.endDate} onChange={(event) => setEditForm((current) => ({ ...current, endDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Start time</span>
                    <input type="time" value={editForm.startTime} onChange={(event) => setEditForm((current) => ({ ...current, startTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">End time</span>
                    <input type="time" value={editForm.endTime} onChange={(event) => setEditForm((current) => ({ ...current, endTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Registration deadline date</span>
                    <input type="date" value={editForm.registrationDeadlineDate} onChange={(event) => setEditForm((current) => ({ ...current, registrationDeadlineDate: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Registration deadline time</span>
                    <input type="time" value={editForm.registrationDeadlineTime} onChange={(event) => setEditForm((current) => ({ ...current, registrationDeadlineTime: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Description</span>
                    <textarea rows={4} value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]" required />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Replace event image</span>
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setEditForm((current) => ({ ...current, image: file }));
                        if (editPreviewImage?.startsWith("blob:")) URL.revokeObjectURL(editPreviewImage);
                        setEditPreviewImage(file ? URL.createObjectURL(file) : editingItem.image_url || "");
                      }}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0]"
                    />
                  </label>
                  {editPreviewImage ? (
                    <div className="md:col-span-2 overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
                      <img src={editPreviewImage} alt="Event preview" className="h-60 w-full object-cover" />
                    </div>
                  ) : null}
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    <button type="submit" disabled={editSubmitting} className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-5 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_16px_34px_-24px_rgba(13,59,46,0.65)] disabled:opacity-70">
                      {editSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                      {editSubmitting ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={closeEditModal}
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
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-semibold text-[#245C4F]">Select Event Category</span>
                    <div className="relative">
                      <select
                        value={form.eventCategory}
                        onChange={(event) => setForm((current) => ({ ...current, eventCategory: event.target.value }))}
                        onFocus={() => setCategoryOpen(true)}
                        onBlur={() => setCategoryOpen(false)}
                        className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                        required
                      >
                        <option value="">Select a category</option>
                        {EVENT_CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#245C4F] transition-transform ${
                          categoryOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </label>
                  <RegistrationFormBuilder category={form.eventCategory} value={form.registrationFormSchema} onChange={(registrationFormSchema) => setForm((current) => ({ ...current, registrationFormSchema }))} />
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

