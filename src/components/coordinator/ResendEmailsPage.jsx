"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Search } from "lucide-react";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Karachi",
  }).format(date);
}

function normalizeEventLabel(value) {
  const key = String(value || "pending").trim().toLowerCase();
  if (!key) return "Pending";
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function eventTone(value) {
  const key = String(value || "").toLowerCase();
  if (["delivered", "opened", "clicked"].includes(key)) return "bg-[#EAF6EF] text-[#0D5C48]";
  if (["bounced", "complained", "failed"].includes(key)) return "bg-[#FCE7E7] text-[#9F1D1D]";
  return "bg-[#FFF5D6] text-[#7A5E2B]";
}

function searchableValue(item, column) {
  if (column === "to") return (item.to || []).join(", ");
  if (column === "created_at") return formatDateTime(item.created_at);
  return String(item?.[column] || "");
}

export default function ResendEmailsPage({
  portalLabel = "Coordinator portal",
  title = "Sent emails",
  description = "Review emails sent to users through Resend.",
}) {
  const pageSize = 7;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [page, setPage] = useState(1);
  const [openSelect, setOpenSelect] = useState("");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [emailPopupLoading, setEmailPopupLoading] = useState(false);
  const [filters, setFilters] = useState({
    event: "all",
    column: "all",
    search: "",
  });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/resend-emails", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load sent emails.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load sent emails.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openEmail(id) {
    setEmailPopupLoading(true);
    setSelectedEmail({ subject: "Loading...", html: "", text: "", to: [] });
    try {
      const response = await fetch(`/api/coordinator/resend-emails/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load email content.");
      setSelectedEmail(data.item || null);
    } catch (error) {
      setSelectedEmail(null);
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load email content.");
    } finally {
      setEmailPopupLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const eventOptions = useMemo(() => {
    const keys = Array.from(new Set(items.map((item) => String(item.last_event || "pending").toLowerCase()).filter(Boolean)));
    return keys.sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = String(filters.search || "").trim().toLowerCase();
    return items.filter((item) => {
      const itemEvent = String(item.last_event || "pending").toLowerCase();
      if (filters.event !== "all" && itemEvent !== filters.event) return false;
      if (!search) return true;

      if (filters.column === "all") {
        return [
          item.subject,
          item.from,
          item.last_event,
          formatDateTime(item.created_at),
          (item.to || []).join(", "),
        ]
          .map((entry) => String(entry || "").toLowerCase())
          .some((entry) => entry.includes(search));
      }

      return searchableValue(item, filters.column).toLowerCase().includes(search);
    });
  }, [filters, items]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, safePage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const fromIndex = filteredItems.length ? (safePage - 1) * pageSize + 1 : 0;
  const toIndex = filteredItems.length ? Math.min(safePage * pageSize, filteredItems.length) : 0;
  const pageNumbers = useMemo(() => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, safePage]);
  if (safePage - 1 > 1) pages.add(safePage - 1);
  if (safePage + 1 < totalPages) pages.add(safePage + 1);

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];
    if (index > 0 && current - previous > 1) {
      result.push("ellipsis-" + index);
    }
    result.push(current);
  }

  return result;
}, [safePage, totalPages]);

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
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{items.length}</p>
                <p className="text-xs text-[#EAF6EF]">Total</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold">{items.filter((item) => String(item.last_event || "").toLowerCase() === "delivered").length}</p>
                <p className="text-xs text-[#EAF6EF]">Delivered</p>
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
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Email filters</p>
          </div>
          <div className="grid gap-4 px-6 py-5 lg:grid-cols-[220px_220px_minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Delivery status</span>
              <div className="relative">
                <select
                  value={filters.event}
                  onFocus={() => setOpenSelect("event")}
                  onBlur={() => setOpenSelect("")}
                  onChange={(event) => setFilters((current) => ({ ...current, event: event.target.value }))}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                >
                  <option value="all">All statuses</option>
                  {eventOptions.map((item) => (
                    <option key={item} value={item}>{normalizeEventLabel(item)}</option>
                  ))}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${openSelect === "event" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search column</span>
              <div className="relative">
                <select
                  value={filters.column}
                  onFocus={() => setOpenSelect("column")}
                  onBlur={() => setOpenSelect("")}
                  onChange={(event) => setFilters((current) => ({ ...current, column: event.target.value }))}
                  className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                >
                  <option value="all">All columns</option>
                  <option value="subject">Subject</option>
                  <option value="to">Recipient</option>
                  <option value="from">From</option>
                  <option value="last_event">Status</option>
                  <option value="created_at">Sent at</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${openSelect === "column" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
                <input
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search sent emails"
                  className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                />
              </div>
            </label>

            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={() => setFilters({ event: "all", column: "all", search: "" })}
                className="inline-flex h-[46px] items-center gap-2 rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 text-sm font-semibold text-[#0D5C48] transition hover:border-[#2D8A6A]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="border-y border-[#2D8A6A]/10 bg-[#FFFDF8] px-6 py-4 text-sm font-semibold text-[#0D5C48] text-end">
            Showing {filteredItems.length} sent emails
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-[#245C4F]">
              <thead className="bg-[#F7F1E3] text-[11px] uppercase tracking-[0.24em] text-[#0D5C48]">
                <tr>
                  <th className="px-6 py-4">#</th>
                  <th className="min-w-[320px] px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Recipient</th>
                  <th className="px-6 py-4">From</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="min-w-[210px] px-6 py-4">Sent At</th>
                  <th className="min-w-[160px] px-6 py-4">Email Content</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-[#245C4F]">Loading sent emails...</td>
                  </tr>
                ) : visibleItems.length ? (
                  visibleItems.map((item, index) => (
                    <tr key={item.id || `${item.subject}-${index}`} className="border-t border-[#2D8A6A]/10 align-top">
                      <td className="px-6 py-4 font-semibold text-[#0D5C48]">{String((safePage - 1) * pageSize + index + 1).padStart(2, "0")}</td>
                      <td className="min-w-[320px] px-6 py-4 font-semibold text-[#063F32]">{item.subject || "-"}</td>
                      <td className="px-6 py-4">{(item.to || []).join(", ") || "-"}</td>
                      <td className="px-6 py-4">{item.from || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${eventTone(item.last_event)}`}>
                          {normalizeEventLabel(item.last_event)}
                        </span>
                      </td>
                      <td className="min-w-[210px] px-6 py-4">{formatDateTime(item.created_at)}</td>
                      <td className="min-w-[160px] px-6 py-4">
                        <button
                          type="button"
                          onClick={() => void openEmail(item.id)}
                          className="inline-flex rounded-full border border-[#2D8A6A]/18 bg-[#EAF6EF] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#2D8A6A]/35 hover:bg-[#dff1e8]"
                        >
                          View Email
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-[#245C4F]">No sent emails matched the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#2D8A6A]/10 px-6 py-5 text-sm text-[#245C4F] lg:flex-row lg:items-center lg:justify-between">
            <p>
              Showing {fromIndex}-{toIndex} of {filteredItems.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage <= 1}
                className="inline-flex items-center justify-center rounded-full border border-[#2D8A6A]/18 bg-[#F7FBF8] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#2D8A6A] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {pageNumbers.map((pageNumber, index) => {
                if (typeof pageNumber === "string") {
                  return (
                    <span
                      key={pageNumber + index}
                      className="inline-flex min-w-[42px] items-center justify-center px-2 py-2 text-sm font-semibold text-[#7A8F88]"
                    >
                      ...
                    </span>
                  );
                }

                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`inline-flex min-w-[42px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${pageNumber === safePage ? "border-[#C9A227] bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_10px_24px_-16px_rgba(201,162,39,0.38)]" : "border-[#2D8A6A]/18 bg-[#F7FBF8] text-[#0D5C48] hover:border-[#2D8A6A] hover:bg-white"}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex items-center justify-center rounded-full border border-[#2D8A6A]/18 bg-[#F7FBF8] px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#2D8A6A] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {selectedEmail ? (
          <div className="fixed inset-0 z-[10010] flex items-center justify-center bg-[#063F32]/28 px-4 py-8 backdrop-blur-[3px]">
            <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,1))] shadow-[0_28px_80px_-32px_rgba(13,59,46,0.34)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A227]">Email content</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">{selectedEmail.subject || "Sent email"}</h2>
                  <p className="mt-2 text-sm text-[#245C4F]">
                    {selectedEmail.to?.length ? `To: ${selectedEmail.to.join(", ")}` : "Recipient not available"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmail(null)}
                  className="rounded-full border border-[#2D8A6A]/18 bg-white px-4 py-2 text-sm font-semibold text-[#0D5C48] transition hover:border-[#2D8A6A]/35 hover:bg-[#f7fbf8]"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[68vh] overflow-y-auto px-6 py-6">
                {emailPopupLoading ? (
                  <p className="text-sm text-[#245C4F]">Loading email content...</p>
                ) : selectedEmail.html ? (
                  <div className="rounded-[1.5rem] border border-[#2D8A6A]/14 bg-white p-5 text-sm leading-7 text-[#245C4F]" dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                ) : (
                  <div className="rounded-[1.5rem] border border-[#2D8A6A]/14 bg-white p-5 text-sm leading-7 whitespace-pre-wrap text-[#245C4F]">
                    {selectedEmail.text || "No email body content available."}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


