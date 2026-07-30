"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, PencilLine, RotateCcw, Search } from "lucide-react";
import { formatEventDate, formatEventDateTime, formatMoney, formatRegistrationStatusLabel, normalizeRegistrationStatus } from "@/lib/publicEvents";

const INITIAL_CREATE_FORM = {
  eventId: "",
  participantName: "",
  email: "",
  whatsapp: "",
  notes: "",
};

function isValidName(value) {
  return /^[a-zA-Z]+(?:[a-zA-Z\s'.-]*[a-zA-Z])?$/.test(String(value || "").trim());
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function statusTone(status) {
  const normalized = normalizeRegistrationStatus(status);
  if (normalized === "free") return "bg-[#E6F4FF] text-[#08527A]";
  if (normalized === "verified") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (normalized === "cancelled") return "bg-[#FCE7E7] text-[#9F1D1D]";
  return "bg-[#FFF5D6] text-[#7A5E2B]";
}

function matchesSearch(item, query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return true;
  return [item.registration_no, item.event_name, item.participant_name, item.email, item.whatsapp, item.status_label, item.status]
    .map((entry) => String(entry || "").toLowerCase())
    .some((entry) => entry.includes(value));
}

export default function PublicEventRegistrationsPage({ portalLabel = "Coordinator portal", title = "Event registrations", description = "Review public event registrations, verify payments, and track each registration from one LMS table.", canManage = true, }) {
  const pageSize = 7;
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [createModalOpen, setCreateModalOpen] = useState(false);  
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState("");
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [amountEditor, setAmountEditor] = useState(null);
  const [amountDraft, setAmountDraft] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [draftStatuses, setDraftStatuses] = useState({});
  const [openFilterSelect, setOpenFilterSelect] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ eventId: "all", status: "all", dateFrom: "", dateTo: "", search: "", sortBy: "submitted_at", sortDir: "desc" });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load event registrations.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load event registrations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/coordinator/public-event-registrations", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data?.message || "Unable to load event registrations.");
        setItems(Array.isArray(data.items) ? data.items : []);
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (error) {
        if (!active) return;
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Unable to load event registrations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setDraftStatuses(Object.fromEntries(items.map((item) => [item.id, normalizeRegistrationStatus(item.status)])));
  }, [items]);



  const availableCreateEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((item) => {
      const deadline = item.registration_deadline ? new Date(item.registration_deadline).getTime() : NaN;
      const endTime = item.end_at ? new Date(item.end_at).getTime() : NaN;
      const published = String(item.publication_status || "").toLowerCase() === "published";
      const deadlineOpen = Number.isNaN(deadline) ? true : deadline >= now;
      const endOpen = Number.isNaN(endTime) ? true : endTime >= now;
      return published && deadlineOpen && endOpen;
    });
  }, [events]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filters.eventId !== "all" && item.event_id !== filters.eventId) return false;
      if (filters.status !== "all" && normalizeRegistrationStatus(item.status) !== filters.status) return false;
      const submittedAt = item.submitted_at ? new Date(item.submitted_at) : null;
      if (filters.dateFrom && submittedAt && submittedAt < new Date(String(filters.dateFrom) + "T00:00:00")) return false;
      if (filters.dateTo && submittedAt && submittedAt > new Date(String(filters.dateTo) + "T23:59:59")) return false;
      return matchesSearch(item, filters.search);
    });

    return [...filtered].sort((left, right) => {
      const direction = filters.sortDir === "asc" ? 1 : -1;
      const leftValue = left[filters.sortBy];
      const rightValue = right[filters.sortBy];
      if (filters.sortBy === "amount_due") return (Number(leftValue || 0) - Number(rightValue || 0)) * direction;
      if (filters.sortBy === "submitted_at") return ((new Date(leftValue || 0)).getTime() - (new Date(rightValue || 0)).getTime()) * direction;
      return String(leftValue || "").localeCompare(String(rightValue || ""), "en", { sensitivity: "base" }) * direction;
    });
  }, [filters, items]);

  const verifiedTotalAmount = useMemo(() => items.reduce((sum, item) => (normalizeRegistrationStatus(item.status) === "verified" ? sum + Number(item.amount_due || 0) : sum), 0), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => filteredItems.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize), [filteredItems, safePage]);

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function updateStatus(id, status) {
    setActionLoadingId(id);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update registration status.");
      setTone("success");
      setMessage("Registration marked " + formatRegistrationStatusLabel(status).toLowerCase() + ".");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update registration status.");
    } finally {
      setActionLoadingId("");
    }
  }

  function openAmountEditor(item) {
    setAmountEditor(item);
    setAmountDraft(String(Number(item?.amount_due || 0)));
  }

  async function saveAmountEdit() {
    if (!amountEditor?.id) return;
    setActionLoadingId(amountEditor.id);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations/" + encodeURIComponent(amountEditor.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountDue: Number(amountDraft || 0) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update amount.");
      setTone("success");
      setMessage("Registration amount updated.");
      setAmountEditor(null);
      setAmountDraft("");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update amount.");
    } finally {
      setActionLoadingId("");
    }
  }

  function resetFilters() {
    setPage(1);
    setFilters({ eventId: "all", status: "all", dateFrom: "", dateTo: "", search: "", sortBy: "submitted_at", sortDir: "desc" });
  }

  function resetCreateForm() {
    setCreateForm({
      ...INITIAL_CREATE_FORM,
      eventId: "",
    });
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSubmitting(false);
  }

  function openCreateModal() {
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSubmitting(false);
    setCreateEventOpen(false);
    setCreateModalOpen(true);
    setCreateForm(INITIAL_CREATE_FORM);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSubmitting(false);
    resetCreateForm();
  }

  function validateCreateForm() {
    const nextErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const whatsappDigits = normalizePhoneDigits(createForm.whatsapp);
    const nameValue = String(createForm.participantName || "").trim();
    const emailValue = String(createForm.email || "").trim().toLowerCase();

    if (!createForm.eventId) {
      nextErrors.eventId = "Please select an event.";
    }
    if (!nameValue) {
      nextErrors.participantName = "Participant name is required.";
    } else if (!isValidName(nameValue)) {
      nextErrors.participantName = "Please enter a valid participant name.";
    }
    if (!emailValue) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(emailValue)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!whatsappDigits) {
      nextErrors.whatsapp = "WhatsApp number is required.";
    } else if (whatsappDigits.length < 10 || whatsappDigits.length > 15) {
      nextErrors.whatsapp = "Please enter a valid WhatsApp number.";
    }

    return nextErrors;
  }

  async function handleCreateRegistration(event) {
    event.preventDefault();
    if (createSubmitting) return;

    const nextErrors = validateCreateForm();
    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }

    setCreateSubmitting(true);
    setCreateErrors({});
    setCreateSubmitError("");

    try {
      const response = await fetch("/api/public-event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: createForm.eventId,
          participantName: String(createForm.participantName || "").trim(),
          email: String(createForm.email || "").trim(),
          whatsapp: String(createForm.whatsapp || "").trim(),
          notes: String(createForm.notes || "").trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = data?.message || "Unable to create event registration.";
        setCreateSubmitError(apiMessage);
        throw new Error(apiMessage);
      }

      setTone("success");
      setMessage("Registration created successfully" + (data?.registrationNo ? " (" + data.registrationNo + ")" : "") + ".");
      closeCreateModal();
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to create event registration.");
    } finally {
      setCreateSubmitting(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        {message ? <div className={`fixed right-4 top-4 z-[10000] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(13,59,46,0.45)] ${tone === "success" ? "border-[#2D8A6A]/25 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]" : "border-rose-200 bg-white text-rose-700"}`}>{message}</div> : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">{portalLabel}</p>
                <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
              </div>
              {canManage ? (
                <button type="button" onClick={openCreateModal} className="inline-flex items-center justify-center rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-5 py-3 text-sm font-semibold text-[#FFF5D6] transition hover:bg-[#FFF5D6] hover:text-[#0D3B2E]">
                  Create Event Registration
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.length}</p><p className="text-xs text-[#EAF6EF]">Total</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "pending").length}</p><p className="text-xs text-[#EAF6EF]">Pending</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "verified").length}</p><p className="text-xs text-[#EAF6EF]">Verified</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "free").length}</p><p className="text-xs text-[#EAF6EF]">Free</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 flex justify-between flex-col"><p className="font-semibold whitespace-nowrap">{formatMoney(verifiedTotalAmount)}</p><p className="text-xs text-[#EAF6EF] whitespace-nowrap">Total Amount</p></div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Registration filters</p>
          </div>
          <div className="grid gap-4 px-6 py-5 lg:grid-cols-6">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Event</span>
              <div className="relative">
                <select value={filters.eventId} onFocus={() => setOpenFilterSelect("event")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); setFilters((current) => ({ ...current, eventId: event.target.value })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="all">All events</option>
                  {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "event" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Status</span>
              <div className="relative">
                <select value={filters.status} onFocus={() => setOpenFilterSelect("status")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); setFilters((current) => ({ ...current, status: event.target.value })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="free">Free</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "status" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">From date</span>
              <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">To date</span>
              <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Sort by</span>
              <div className="relative">
                <select value={`${filters.sortBy}:${filters.sortDir}`} onFocus={() => setOpenFilterSelect("sort")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); const [sortBy, sortDir] = String(event.target.value || "").split(":"); setFilters((current) => ({ ...current, sortBy, sortDir })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="submitted_at:desc">Latest submitted</option>
                  <option value="submitted_at:asc">Oldest submitted</option>
                  <option value="event_name:asc">Event name A-Z</option>
                  <option value="participant_name:asc">Participant A-Z</option>
                  <option value="amount_due:desc">Amount high-low</option>
                  <option value="amount_due:asc">Amount low-high</option>
                  <option value="status:asc">Status A-Z</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "sort" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <div className="flex items-end">
              <button type="button" onClick={resetFilters} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </button>
            </div>

            <label className="block lg:col-span-6">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search registration no, event, participant, email, WhatsApp, or status" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
              </div>
            </label>
          </div>
        </section>
        <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Registered events data</p>
            <div className="text-sm font-semibold text-[#245C4F]">Showing {filteredItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredItems.length)} of {filteredItems.length}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">Registration No</th>
                  <th className="whitespace-nowrap px-6 py-4">Event</th>
                  <th className="whitespace-nowrap px-6 py-4">Event Date</th>
                  <th className="whitespace-nowrap px-6 py-4">Participant</th>
                  <th className="whitespace-nowrap px-6 py-4">Email</th>
                  <th className="whitespace-nowrap px-6 py-4">WhatsApp</th>
                  <th className="whitespace-nowrap px-6 py-4">Amount</th>
                  <th className="whitespace-nowrap px-6 py-4">Status</th>
                  <th className="whitespace-nowrap px-6 py-4">Submitted</th>
                  <th className="whitespace-nowrap px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {visibleItems.length ? visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 font-semibold text-[#063F32]">{item.registration_no}</td>
                    <td className="px-6 py-4 font-medium text-[#063F32]">{item.event_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatEventDate(item.event_start_at)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.participant_name || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.email || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.whatsapp || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span>{formatMoney(item.amount_due || 0)}</span>
                        {canManage && normalizeRegistrationStatus(item.status) !== "free" ? (
                          <button type="button" onClick={() => openAmountEditor(item)} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                            <PencilLine className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status_label || formatRegistrationStatusLabel(item.status)}</span></td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatEventDateTime(item.submitted_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex min-w-max flex-nowrap gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => setSelected(item)} className="inline-flex shrink-0 items-center rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] whitespace-nowrap transition hover:bg-[#F1EADC]"><span className="inline-flex items-center gap-2 whitespace-nowrap"><Eye className="h-3.5 w-3.5" /> View</span></button>
                        {canManage && normalizeRegistrationStatus(item.status) !== "free" ? (
                          <div className="flex min-w-max flex-nowrap items-center gap-2 whitespace-nowrap">
                            <select value={draftStatuses[item.id] || normalizeRegistrationStatus(item.status)} onChange={(event) => setDraftStatuses((current) => ({ ...current, [item.id]: event.target.value }))} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] outline-none focus:border-[#2D8A6A]">
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                              <option value="free">Free</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <button type="button" disabled={actionLoadingId === item.id || (draftStatuses[item.id] || normalizeRegistrationStatus(item.status)) === normalizeRegistrationStatus(item.status)} onClick={() => updateStatus(item.id, draftStatuses[item.id] || normalizeRegistrationStatus(item.status))} className="rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70">
                              {actionLoadingId === item.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={10} className="px-6 py-10 text-center text-[#245C4F]">{loading ? "Loading event registrations..." : "No registrations matched the selected filters."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredItems.length > pageSize ? (
            <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#245C4F]">Page {safePage} of {totalPages}</p>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </div>
          ) : null}
        </section>

        {createModalOpen ? (
          <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Create event registration</p>
                </div>
                <button type="button" onClick={closeCreateModal} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              <form onSubmit={handleCreateRegistration} className="space-y-5 p-6 text-sm text-[#245C4F]">
                <div className="grid gap-4 md:grid-cols-2">
                  {createSubmitError ? <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{createSubmitError}</div> : null}
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Event *</span>
                    <div className="relative">
                      <select
                        value={createForm.eventId}
                        onFocus={() => setCreateEventOpen(true)}
                        onBlur={() => setCreateEventOpen(false)}
                        onChange={(event) => {
                          const nextEventId = event.target.value;
                          setCreateForm((current) => ({ ...current, eventId: nextEventId }));
                        }}
                        className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                      >
                        <option value="">Select an open event</option>
                        {availableCreateEvents.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${createEventOpen ? 'rotate-180' : ''}`} />
                    </div>
                    {createErrors.eventId ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.eventId}</p> : null}
                    {createForm.eventId ? (
                      <div className="mt-3 rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3 text-xs text-[#245C4F]">
                        {(() => {
                          const selectedEvent = availableCreateEvents.find((item) => item.id === createForm.eventId) || events.find((item) => item.id === createForm.eventId);
                          const selectedFee = selectedEvent?.event_fee_amount ?? 0;
                          const selectedDeadline = selectedEvent?.registration_deadline || selectedEvent?.deadline || null;
                          return selectedEvent ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="sm:col-span-2">
                                <p className="font-semibold text-[#063F32]">{selectedEvent.title || "-"}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Start</p>
                                <p className="mt-1">{formatEventDateTime(selectedEvent.start_at)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">End</p>
                                <p className="mt-1">{formatEventDateTime(selectedEvent.end_at)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Deadline</p>
                                <p className="mt-1">{formatEventDateTime(selectedDeadline)}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Fee</p>
                                <p className="mt-1">{formatMoney(selectedFee)}</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Participant name *</span>
                    <input value={createForm.participantName} onChange={(event) => setCreateForm((current) => ({ ...current, participantName: event.target.value }))} placeholder="Full name" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
                    {createErrors.participantName ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.participantName}</p> : null}
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Email *</span>
                    <input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@gmail.com" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
                    {createErrors.email ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.email}</p> : null}
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">WhatsApp *</span>
                    <input value={createForm.whatsapp} onChange={(event) => setCreateForm((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="Enter whatsapp number" inputMode="tel" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
                    {createErrors.whatsapp ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.whatsapp}</p> : null}
                  </label>

                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Notes</span>
                    <textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="If you want to share anything in advance with the coordinator" className="w-full rounded-[24px] border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={closeCreateModal} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Cancel</button>
                  <button type="submit" disabled={createSubmitting} className="rounded-full bg-[#0D5C48] px-5 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70">
                    {createSubmitting ? "Creating..." : "Create event registration"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {amountEditor ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Edit amount</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{amountEditor.registration_no}</h2>
                </div>
                <button type="button" onClick={() => { setAmountEditor(null); setAmountDraft(""); }} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              <div className="space-y-4 p-6 text-sm text-[#245C4F]">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Amount</span>
                  <input type="number" min="0" step="0.01" value={amountDraft} onChange={(event) => setAmountDraft(event.target.value)} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
                </label>
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => { setAmountEditor(null); setAmountDraft(""); }} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Cancel</button>
                  <button type="button" onClick={saveAmountEdit} disabled={actionLoadingId === amountEditor.id} className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70">{actionLoadingId === amountEditor.id ? "Saving..." : "Save amount"}</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {selected ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Registration details</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.registration_no}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              <div className="space-y-4 p-6 text-sm text-[#245C4F]">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Event</p><p className="mt-1">{selected.event_name || "-"}</p></div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Amount due</p><p className="mt-1">{formatMoney(selected.amount_due || 0)}</p></div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Status</p><p className="mt-1">{formatRegistrationStatusLabel(selected.status)}</p></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Participant information</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Participant:</span> {selected.participant_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Email:</span> {selected.email || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">WhatsApp:</span> {selected.whatsapp || "-"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Event and verification</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Schedule:</span> {formatEventDateTime(selected.event_start_at)} to {formatEventDateTime(selected.event_end_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Submitted:</span> {formatEventDateTime(selected.submitted_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Verified at:</span> {formatEventDateTime(selected.verified_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Verified by:</span> {selected.verified_by_name || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Coordinator contact</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Name:</span> {selected.coordinator_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Email:</span> {selected.coordinator_email || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Phone:</span> {selected.coordinator_phone || "+92 3473547036"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Notes</p>
                    <p className="mt-3 whitespace-pre-line">{selected.notes || "No notes provided."}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}



