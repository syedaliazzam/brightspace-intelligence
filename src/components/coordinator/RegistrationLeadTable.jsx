"use client";

import { motion } from "framer-motion";

const STATUS_STYLES = {
  new_lead: "bg-sky-50 text-sky-700",
  voucher_created: "bg-amber-50 text-amber-700",
  fee_submitted: "bg-violet-50 text-violet-700",
  fee_verified: "bg-emerald-50 text-emerald-700",
  access_granted: "bg-teal-50 text-teal-700",
  rejected: "bg-rose-50 text-rose-700",
  pending_clarification: "bg-orange-50 text-orange-700",
};

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getDisplayStatus(lead) {
  if (lead?.status === "voucher_created" && !lead?.has_voucher) {
    return "new_lead";
  }

  return lead?.status || "";
}

export default function RegistrationLeadTable({ leads }) {
  if (!leads.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-10 text-center text-sm text-slate-500 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
        No registration leads match the current filters.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/90 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Parent</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead, index) => {
                const displayStatus = getDisplayStatus(lead);

                return (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="align-top"
                >
                  <td className="px-6 py-5">
                    <p className="font-semibold text-slate-950">{lead.student_name}</p>
                    <p className="mt-1 text-sm text-slate-500">{lead.class_level || "Class not selected"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-slate-800">{lead.parent_name || "Not provided"}</p>
                    <p className="mt-1 text-sm text-slate-500">{lead.parent_relation || "Relation not set"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="font-medium text-slate-800">{lead.class_level}</p>
                    <p className="mt-1 text-sm text-slate-500">{lead.preferred_schedule || "Schedule pending"}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-sm text-slate-700">{lead.email || "No email"}</p>
                    <p className="mt-1 text-sm text-slate-500">{lead.phone || "No phone"}</p>
                  </td>
                  <td className="px-6 py-5 text-sm text-slate-600">{formatDate(lead.submitted_at)}</td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {formatStatus(displayStatus)}
                    </span>
                  </td>
                </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:hidden">
        {leads.map((lead, index) => {
          const displayStatus = getDisplayStatus(lead);

          return (
          <motion.article
            key={lead.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.02 }}
            className="rounded-[1.5rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-950">{lead.student_name}</p>
                <p className="mt-1 text-sm text-slate-500">{lead.class_level}</p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-700"
                }`}
              >
                {formatStatus(displayStatus)}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">Parent</dt>
                <dd className="mt-1 text-slate-800">{lead.parent_name || "Not provided"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Contact</dt>
                <dd className="mt-1 text-slate-800">{lead.email || lead.phone || "Not provided"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Schedule</dt>
                <dd className="mt-1 text-slate-800">{lead.preferred_schedule || "Pending"}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Submitted</dt>
                <dd className="mt-1 text-slate-800">{formatDate(lead.submitted_at)}</dd>
              </div>
            </dl>
          </motion.article>
          );
        })}
      </div>
    </section>
  );
}
