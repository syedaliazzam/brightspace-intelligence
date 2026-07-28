"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, RotateCcw, Search } from "lucide-react";
import {
  formatEventDate,
  formatEventDateTime,
  formatMoney,
  formatRegistrationStatusLabel,
  normalizeRegistrationStatus,
} from "@/lib/publicEvents";

function statusTone(status) {
  const normalized = normalizeRegistrationStatus(status);
  if (normalized === "verified") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (normalized === "cancelled") return "bg-[#FCE7E7] text-[#9F1D1D]";
  return "bg-[#FFF5D6] text-[#7A5E2B]";
}

function matchesSearch(item, query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return true;

  return [
    item.registration_no,
    item.event_name,
    item.participant_name,
    item.email,
    item.whatsapp,
    item.status_label,
    item.status,
  ]
    .map((entry) => String(entry || "").toLowerCase())
    .some((entry) => entry.includes(value));
}

export default function PublicEventRegistrationsPage({
  portalLabel = "Coordinator portal",
  title = "Event registrations",
  description = "Review public event registrations, verify payments, and track each registration from one LMS table.",
  canManage = true,
}) {
  const pageSize = 7;
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [selected, setSelected] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [draftStatuses, setDraftStatuses] = useState({});
  const [openFilterSelect, setOpenFilterSelect] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    eventId: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
    search: "",
    sortBy: "submitted_at",
    sortDir: "desc",
  });

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

    async function loadInitial() {
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
    }

    void loadInitial();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setDraftStatuses(
      Object.fromEntries(
        items.map((item) => [item.id, normalizeRegistrationStatus(item.status)])
      )
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filters.eventId !== "all" && item.event_id !== filters.eventId) return false;
      if (filters.status !== "all" && normalizeRegistrationStatus(item.status) !== filters.status) return false;

      const submittedAt = item.submitted_at ? new Date(item.submitted_at) : null;
      if (filters.dateFrom && submittedAt && submittedAt < new Date(`${filters.dateFrom}T00:00:00`)) return false;
      if (filters.dateTo && submittedAt && submittedAt > new Date(`${filters.dateTo}T23:59:59`)) return false;

      return matchesSearch(item, filters.search);
    });

    const sorted = [...filtered].sort((left, right) => {
      const direction = filters.sortDir === "asc" ? 1 : -1;
      const leftValue = left[filters.sortBy];
      const rightValue = right[filters.sortBy];

      if (filters.sortBy === "amount_due") {
        return (Number(leftValue || 0) - Number(rightValue || 0)) * direction;
      }

      if (filters.sortBy === "submitted_at") {
        return ((new Date(leftValue || 0)).getTime() - (new Date(rightValue || 0)).getTime()) * direction;
      }

      return String(leftValue || "").localeCompare(String(rightValue || ""), "en", { sensitivity: "base" }) * direction;
    });

    return sorted;
  }, [filters, items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function updateStatus(id, status) {
    setActionLoadingId(id);
    try {
      const response = await fetch(`/api/coordinator/public-event-registrations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update registration status.");
      setTone("success");
      setMessage(`Registration marked ${formatRegistrationStatusLabel(status).toLowerCase()}.`);
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update registration status.");
    } finally {
      setActionLoadingId("");
    }
  }

  function resetFilters() {
    setPage(1);
    setFilters({
      eventId: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
      search: "",
      sortBy: "submitted_at",
      sortDir: "desc",
    });
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
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{items.length}</p>
                <p className="text-xs text-[#EAF6EF]">Total</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "pending").length}</p>
                <p className="text-xs text-[#EAF6EF]">Pending</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "verified").length}</p>
                <p className="text-xs text-[#EAF6EF]">Verified</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{filteredItems.length}</p>
                <p className="text-xs text-[#EAF6EF]">Filtered</p>
              </div>
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
                <select
                  value={filters.eventId}
                  onFocus={() => setOpenFilterSelect("event")}
                  onBlur={() => setOpenFilterSelect("")}
                  onChange={(event) => {
                    setOpenFilterSelect("");
                    setFilters((current) => ({ ...current, eventId: event.target.value }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                >
                  <option value="all">All events</option>
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "event" ? "rotate-180" : ""}`} />
              </div>
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Status</span>
              <div className="relative">
                <select
                  value={filters.status}
                  onFocus={() => setOpenFilterSelect("status")}
                  onBlur={() => setOpenFilterSelect("")}
                  onChange={(event) => {
                    setOpenFilterSelect("");
                    setFilters((current) => ({ ...current, status: event.target.value }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                >
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
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
                <select
                  value={`${filters.sortBy}:${filters.sortDir}`}
                  onFocus={() => setOpenFilterSelect("sort")}
                  onBlur={() => setOpenFilterSelect("")}
                  onChange={(event) => {
                    setOpenFilterSelect("");
                    const [sortBy, sortDir] = String(event.target.value || "").split(":");
                    setFilters((current) => ({ ...current, sortBy, sortDir }));
                  }}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                >
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
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
              Registered events data
            </p>

            <div className="text-sm font-semibold text-[#245C4F]">
              Showing {filteredItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredItems.length)} of {filteredItems.length}
            </div>
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
                    <td className="px-6 py-4 text-[#245C4F]">{formatMoney(item.amount_due || 0)}</td>
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status_label || formatRegistrationStatusLabel(item.status)}</span></td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatEventDateTime(item.submitted_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-nowrap gap-2">
                        <button type="button" onClick={() => setSelected(item)} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                          <span className="inline-flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> View</span>
                        </button>
                        {canManage ? (
                          <div className="flex flex-nowrap items-center gap-2">
                            <select
                              value={draftStatuses[item.id] || normalizeRegistrationStatus(item.status)}
                              onChange={(event) =>
                                setDraftStatuses((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                              className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] outline-none focus:border-[#2D8A6A]"
                            >
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <button
                              type="button"
                              disabled={
                                actionLoadingId === item.id ||
                                (draftStatuses[item.id] || normalizeRegistrationStatus(item.status)) === normalizeRegistrationStatus(item.status)
                              }
                              onClick={() => updateStatus(item.id, draftStatuses[item.id] || normalizeRegistrationStatus(item.status))}
                              className="rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70"
                            >
                              {actionLoadingId === item.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-[#245C4F]">
                      {loading ? "Loading event registrations..." : "No registrations matched the selected filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredItems.length > pageSize ? (
            <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#245C4F]">
                Page {safePage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>

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
                      <p><span className="font-semibold text-[#063F32]">Phone:</span> {selected.coordinator_phone || "-"}</p>
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
