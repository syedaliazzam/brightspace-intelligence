"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, HelpCircle } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import InterestedStudentsPanel from "@/components/coordinator/InterestedStudentsPanel";

const FILTERS = [
  { id: "all", label: "All Records" },
  { id: "pending", label: "New Registrations" },
  { id: "sent", label: "Admission Form Sent" },
  { id: "reminded", label: "Reminder Sent" },
  { id: "overdue", label: "Overdue" },
  { id: "not_submitted", label: "Form Not Submitted" },
  { id: "submitted", label: "Form Submitted" },
];

const STATUS_HELP = {
  pending: {
    title: "New Registrations",
    lines: [
      "A new interested student has registered on the website.",
      "The admission form has not been sent yet.",
    ],
  },
  sent: {
    title: "Admission Form Sent",
    lines: [
      "The admission form link has been sent to the parent or guardian.",
      "The application is waiting for the parent to complete the form.",
    ],
  },
  reminded: {
    title: "Reminder Sent",
    lines: [
      "A follow-up reminder was sent after the original form link.",
      "Use this when the parent needs another reminder before the due date.",
    ],
  },
  overdue: {
    title: "Overdue",
    lines: [
      "The due date passed and the admission form has still not been submitted.",
      "This usually needs another follow-up or phone call.",
    ],
  },
  not_submitted: {
    title: "Form Not Submitted",
    lines: [
      "The form was sent, but the parent has not completed it yet.",
      "This status helps you track incomplete applications.",
    ],
  },
  submitted: {
    title: "Form Submitted",
    lines: [
      "The parent completed and submitted the admission form.",
      "This is ready for admissions review.",
    ],
  },
};

export default function CoordinatorInterestedStudentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const response = await fetch("/api/coordinator/interested-students", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load interested students.");
      }

      if (active) {
        setState({ items: data.items || [], loading: false, error: "" });
      }
    }

    load().catch((error) => {
      if (active) {
        setState({ items: [], loading: false, error: error.message });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const normalizedItems = useMemo(
    () =>
      state.items.map((item) => {
        const rawStatus = String(item.admission_form_status || item.status || "pending").toLowerCase();
        const status = rawStatus === "registered" ? "submitted" : rawStatus;
        return { ...item, __status: status };
      }),
    [state.items]
  );

  const statusCounts = useMemo(() => {
    const counts = {
      all: normalizedItems.length,
      pending: 0,
      sent: 0,
      reminded: 0,
      overdue: 0,
      not_submitted: 0,
      submitted: 0,
    };

    for (const item of normalizedItems) {
      if (counts[item.__status] !== undefined) counts[item.__status] += 1;
      if (item.__status === "not_submitted") counts.not_submitted += 1;
    }

    return counts;
  }, [normalizedItems]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return normalizedItems.filter((item) => {
      const matchesStatus = activeFilter === "all" || item.__status === activeFilter;
      if (!matchesStatus) return false;
      if (!query) return true;
      return [
        item.parent_name,
        item.email,
        item.phone,
        item.student_name,
        item.child_name,
        item.child_age,
        item.class_level,
        item.city_country,
        item.message,
        item.notes,
        item.__status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [activeFilter, normalizedItems, search]);

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
          <div className="relative">
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              Coordinator portal
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">
              New interested records of students
            </h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Review interested student submissions and generate registration links.
            </p>
          </div>
        </section>

        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        {state.loading ? <OpenBookLoader title="Loading interested students" subtitle="Fetching admission leads..." /> : null}

        {!state.loading ? (
          <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
            <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Admission form status</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-[#063F32]">5-day reminder tracking</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-[#245C4F]">
                    Monitor pending admissions, reminders sent, overdue records, and submitted applications in one view.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 [@media(min-width:500px)]:grid-cols-3 [@media(min-width:668px)]:grid-cols-4 [@media(min-width:992px)]:grid-cols-6">
                  {FILTERS.slice(1).map((item) => {
                    const help = STATUS_HELP[item.id];
                    const isPending = item.id === "pending";
                    const isSubmitted = item.id === "submitted";
                    const tooltipPlacement = isPending
                      ? "left-0"
                      : isSubmitted
                        ? "right-0"
                        : "left-1/2 -translate-x-1/2";

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-center shadow-[0_12px_30px_-24px_rgba(13,59,46,0.2)]"
                      >
                        <div className="flex items-start justify-center gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">{item.label}</p>
                          {help ? (
                            <div className="relative -mt-0.5">
                              <button
                                type="button"
                                aria-label={`${item.label} status help`}
                                className="peer inline-flex h-5 w-5 items-center justify-center rounded-full text-[#0D5C48] transition hover:bg-[#FFF5D6] hover:text-[#063F32]"
                              >
                                <HelpCircle className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <div
                                className={`pointer-events-none absolute top-full z-20 mt-2 w-72 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 text-left text-xs leading-6 text-[#245C4F] opacity-0 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.22)] transition peer-hover:opacity-100 peer-focus-visible:opacity-100 ${tooltipPlacement}`}
                              >
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{help.title}</p>
                                {help.lines.map((line) => (
                                  <p key={line} className="mt-2">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <p className="mt-1 text-2xl font-bold text-[#063F32]">{statusCounts[item.id] || 0}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-b border-[#2D8A6A]/10 px-6 py-4">
              <label className="flex items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-white px-4 py-3 shadow-sm">
                <ClipboardList className="h-4 w-4 text-[#0D5C48]" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by parent, child, email, phone, city, message, or status"
                  className="w-full bg-transparent text-sm text-[#063F32] outline-none placeholder:text-[#7A938B]"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-[#2D8A6A]/10 px-6 py-4">
              {FILTERS.map((item) => {
                const active = activeFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveFilter(item.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-[0_12px_24px_-16px_rgba(201,162,39,0.55)]"
                        : "border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
                    }`}
                  >
                    {item.label}
                    {activeFilter !== "all" && item.id !== "all" ? (
                      <span className="ml-2 text-[11px] font-bold">{statusCounts[item.id] || 0}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-5">
              <InterestedStudentsPanel items={filteredItems} showFlowColumn />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
