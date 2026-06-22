"use client";

import { useEffect, useMemo, useState } from "react";

const LABELS = {
  new_lead: "New leads",
  voucher_created: "Voucher created",
  fee_submitted: "Payment proof submitted",
  fee_verified: "Payment verified",
  access_granted: "LMS access granted",
  rejected: "Rejected",
  pending_clarification: "Pending clarification",
  pending: "Pending review",
  verified: "Verified",
  submitted: "Submitted",
  unpaid: "Unpaid",
  scheduled: "Scheduled",
  upcoming: "Upcoming",
  live: "Live",
  completed_by_teacher: "Completed by teacher",
  verified_by_coordinator: "Verified by coordinator",
  disputed: "Needs review",
  missed: "Missed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
};

const REPORTS = [
  {
    key: "registrationPipeline",
    title: "Registration Pipeline",
    description: "Where each student registration currently stands.",
    itemLabel: "Registration status",
    valueLabel: "Leads",
  },
  {
    key: "feeVerification",
    title: "Payment Verification",
    description: "Payment proof records grouped by review status.",
    itemLabel: "Payment status",
    valueLabel: "Payments",
  },
  {
    key: "lectureCompletion",
    title: "Class Delivery",
    description: "Lecture schedules grouped by delivery outcome.",
    itemLabel: "Class status",
    valueLabel: "Classes",
  },
  {
    key: "teacherClassReport",
    title: "Teacher Workload",
    description: "Teachers with the highest number of assigned classes.",
    itemLabel: "Teacher",
    valueLabel: "Classes",
  },
  {
    key: "studentActivity",
    title: "Student Activity",
    description: "Students with the highest number of scheduled classes.",
    itemLabel: "Student",
    valueLabel: "Classes",
  },
];

function humanize(value) {
  const text = String(value || "").trim();
  if (!text) return "Not specified";
  return LABELS[text.toLowerCase()] || text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ReportCard({ title, description, rows, itemLabel, valueLabel }) {
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [rows]);

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const canPaginate = rows.length > 5;
  const hasMore = visibleCount < rows.length;

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1fr_110px] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>{itemLabel}</span>
          <span className="text-right">{valueLabel}</span>
        </div>
        {rows?.length ? (
          <>
            {visibleRows.map((row) => (
            <div key={`${title}-${row.label}`} className="grid grid-cols-[1fr_110px] border-t border-slate-100 px-4 py-3 text-sm">
              <span className="text-slate-600">{humanize(row.label)}</span>
              <span className="font-semibold text-slate-950">{row.total}</span>
            </div>
            ))}
            {canPaginate ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setVisibleCount((current) => (current >= rows.length ? 5 : Math.min(current + 5, rows.length)))}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  {hasMore ? "Show more" : "Show less"}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">No records available for this report.</p>
        )}
      </div>
    </section>
  );
}

export default function CoordinatorReportsPanel({ data }) {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {REPORTS.map((report) => (
        <ReportCard
          key={report.key}
          title={report.title}
          description={report.description}
          rows={data?.[report.key] || []}
          itemLabel={report.itemLabel}
          valueLabel={report.valueLabel}
        />
      ))}
    </div>
  );
}
