"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import InterestedStudentsPanel from "@/components/coordinator/InterestedStudentsPanel";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sent", label: "Sent" },
  { id: "reminded", label: "Reminded" },
  { id: "overdue", label: "Overdue" },
  { id: "not_submitted", label: "Not Submitted" },
  { id: "submitted", label: "Submitted" },
];

const STATUS_HELP = {
  pending: {
    title: "Pending status",
    lines: [
      "The admission form has not been sent yet. This is the first stage for a new interested student.",
      "Once the form is sent, the status moves to Sent. If the due date passes without submission, it can become Overdue or Not Submitted.",
    ],
  },
  sent: {
    title: "Sent status",
    lines: [
      "The admission form link has been sent to the parent or guardian.",
      "This means the application is in progress and waiting for form completion.",
    ],
  },
  reminded: {
    title: "Reminded status",
    lines: [
      "A reminder message was sent after the original form link.",
      "Use this when the admission form needs a follow-up before the due date.",
    ],
  },
  overdue: {
    title: "Overdue status",
    lines: [
      "The admission form due date has passed and the form has still not been submitted.",
      "This usually means another follow-up is needed.",
    ],
  },
  not_submitted: {
    title: "Not Submitted status",
    lines: [
      "The admission form was sent, but the applicant has not submitted it yet.",
      "This status is used when the reminder period has ended without a completed form.",
    ],
  },
  submitted: {
    title: "Submitted status",
    lines: [
      "The admission form has been completed and sent back by the parent or guardian.",
      "This is the final stage before the admissions team reviews the submission.",
    ],
  },
};

export default function CoordinatorInterestedStudentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [activeFilter, setActiveFilter] = useState("all");

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

  const statusCounts = useMemo(() => {
    const counts = {
      all: state.items.length,
      pending: 0,
      sent: 0,
      reminded: 0,
      overdue: 0,
      not_submitted: 0,
      submitted: 0,
    };

    for (const item of state.items) {
      const rawStatus = String(item.admission_form_status || item.status || "pending").toLowerCase();
      const status = rawStatus === "registered" ? "submitted" : rawStatus;
      if (counts[status] !== undefined) counts[status] += 1;
      if (status === "not_submitted") counts.not_submitted += 1;
    }

    return counts;
  }, [state.items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return state.items;
    return state.items.filter((item) => {
      const rawStatus = String(item.admission_form_status || item.status || "pending").toLowerCase();
      const status = rawStatus === "registered" ? "submitted" : rawStatus;
      return status === activeFilter;
    });
  }, [activeFilter, state.items]);

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
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">New interested records of students</h1>
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
                  const isPending = item.id === "pending";
                  const isSubmitted = item.id === "submitted";
                  const help = STATUS_HELP[item.id];
                  const tooltipPlacement = isPending
                    ? "left-2 -translate-x-0"
                    : isSubmitted
                      ? "right-2 translate-x-0"
                      : "left-1/2 -translate-x-1/2";

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-center shadow-[0_12px_30px_-24px_rgba(13,59,46,0.2)]"
                    >
                      <div className="flex items-start justify-center gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">
                          {item.label}
                        </p>
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
                              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                                {help.title}
                              </p>
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
            <InterestedStudentsPanel items={filteredItems} />
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}
