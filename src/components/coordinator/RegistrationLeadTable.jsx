"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const STATUS_STYLES = {
  new_lead: "bg-[#EAF6EF] text-[#0D5C48]",
  voucher_created: "bg-[#FFF5D6] text-[#8A6B00]",
  fee_submitted: "bg-[#FFF5D6] text-[#8A6B00]",
  fee_verified: "bg-[#EAF6EF] text-[#0D5C48]",
  access_granted: "bg-[#EAF6EF] text-[#0D5C48]",
  rejected: "bg-rose-50 text-rose-700",
  pending_clarification: "bg-[#FFF5D6] text-[#8A6B00]",
};

function formatStatus(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";

  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function getDisplayStatus(lead) {
  return lead?.status || "";
}

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">{label}</dt>
      <dd className="mt-1 text-sm leading-6 text-[#063F32]">{value || "Not provided"}</dd>
    </div>
  );
}

function DocumentLink({ label, href }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex rounded-full border border-[#2D8A6A]/20 bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#063F32]"
    >
      {label}
    </a>
  );
}

function LeadDetailsModal({ lead, onClose, onCreateVoucher }) {
  if (!lead) return null;

  const canCreateVoucher =
    lead?.can_create_voucher === true ||
    lead?.canCreateVoucher === true ||
    lead?.status === "new_lead";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#063F32]/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-6xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_30px_90px_-40px_rgba(13,59,46,0.28)]">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2rem] border-b border-[#2D8A6A]/15 bg-[#FAF7F0] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-[#063F32]">{lead.student_name}</h2>
            <p className="mt-1 text-sm text-[#245C4F]">
              {lead.class_level || "Class not selected"} • Submitted {formatDateTime(lead.submitted_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateVoucher ? (
              <button
                type="button"
                onClick={() => {
                  onCreateVoucher?.(lead);
                  onClose();
                }}
                className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
              >
                Create Voucher
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#2D8A6A]/20 px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Admission overview</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Programme" value={lead.program_name} />
                <DetailRow
                  label="Preferred start"
                  value={lead.preferred_starting_month_other || lead.preferred_starting_month}
                />
                <DetailRow label="Status" value={formatStatus(lead.status)} />
                <DetailRow label="Source" value={lead.hear_about_source || lead.source} />
                <DetailRow label="Class" value={lead.class_level} />
                <DetailRow label="Current grade" value={lead.current_grade} />
                <DetailRow label="Shift reason" value={lead.shift_reason} />
                <DetailRow label="Online classes before" value={lead.attended_online_classes ? "Yes" : "No"} />
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Student details</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <DetailRow label="Student name" value={lead.student_name} />
                <DetailRow label="Student name Urdu" value={lead.student_name_urdu} />
                <DetailRow label="Gender" value={lead.gender} />
                <DetailRow label="Date of birth" value={formatDate(lead.date_of_birth)} />
                <DetailRow label="Age" value={lead.student_age ? String(lead.student_age) : ""} />
                <DetailRow label="Current school" value={lead.current_school} />
                <DetailRow label="Country" value={lead.country} />
                <DetailRow label="City" value={lead.city_country} />
                <DetailRow label="Nationality" value={lead.nationality} />
                <DetailRow label="Religion" value={lead.religion} />
                <DetailRow label="Preferred language" value={lead.preferred_language} />
                <DetailRow label="Interested in school" value={lead.interest_reason} />
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Child profile</h3>
              <dl className="mt-4 grid gap-4">
                <DetailRow label="Child profile" value={lead.child_profile} />
                <DetailRow label="Strengths" value={lead.child_strengths} />
                <DetailRow label="Support needs" value={lead.child_support_needs} />
                <DetailRow label="Special interests" value={lead.child_special_interests} />
                <DetailRow label="Development concern" value={lead.developmental_concern ? "Yes" : "No"} />
                <DetailRow label="Concern details" value={lead.developmental_concern_details} />
                <DetailRow label="Medical conditions" value={lead.medical_conditions} />
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Contact summary</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                <DetailRow label="Parent name" value={lead.parent_name} />
                <DetailRow label="Relation" value={lead.parent_relation} />
                <DetailRow label="Email" value={lead.email} />
                <DetailRow label="Phone" value={lead.phone} />
                <DetailRow label="Preferred contact person" value={lead.preferred_contact_person} />
                <DetailRow label="Support person during learning" value={lead.support_person_during_learning} />
                <DetailRow label="Device available" value={lead.device_available} />
                <DetailRow label="School expectations" value={lead.school_expectations} />
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Father details</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                <DetailRow label="Name English" value={lead.father_name_english} />
                <DetailRow label="Name Urdu" value={lead.father_name_urdu} />
                <DetailRow label="CNIC" value={lead.father_cnic} />
                <DetailRow label="Qualification" value={lead.father_qualification} />
                <DetailRow label="Occupation" value={lead.father_occupation} />
                <DetailRow label="Mother tongue" value={lead.father_mother_tongue} />
                <DetailRow label="Home contact" value={lead.father_contact_home} />
                <DetailRow label="Office contact" value={lead.father_contact_office} />
                <DetailRow label="WhatsApp" value={lead.father_contact_whatsapp} />
                <DetailRow label="Emergency contact" value={lead.father_emergency_contact} />
                <DetailRow label="Email" value={lead.father_email} />
                <DetailRow label="Address" value={lead.father_residential_address} />
              </dl>
            </section>

            <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
              <h3 className="text-lg font-semibold text-[#063F32]">Mother details</h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 break-words">
                <DetailRow label="Name English" value={lead.mother_name_english} />
                <DetailRow label="Name Urdu" value={lead.mother_name_urdu} />
                <DetailRow label="CNIC" value={lead.mother_cnic} />
                <DetailRow label="Qualification" value={lead.mother_qualification} />
                <DetailRow label="Occupation" value={lead.mother_occupation} />
                <DetailRow label="Mother tongue" value={lead.mother_mother_tongue} />
                <DetailRow label="Home contact" value={lead.mother_contact_home} />
                <DetailRow label="Office contact" value={lead.mother_contact_office} />
                <DetailRow label="WhatsApp" value={lead.mother_contact_whatsapp} />
                <DetailRow label="Emergency contact" value={lead.mother_emergency_contact} />
                <DetailRow label="Email" value={lead.mother_email} />
                <DetailRow label="Address" value={lead.mother_residential_address} />
              </dl>
            </section>
          </div>

          <section className="mt-6 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5">
            <h3 className="text-lg font-semibold text-[#063F32]">Documents and notes</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <DocumentLink label="Birth certificate" href={lead.birth_certificate_file_url} />
              <DocumentLink label="Parent CNIC" href={lead.parent_cnic_file_url} />
              <DocumentLink label="Child photograph" href={lead.child_photograph_file_url} />
              <DocumentLink label="Previous school report" href={lead.previous_school_report_file_url} />
              <DocumentLink label="Medical report" href={lead.medical_report_file_url} />
            </div>
            <dl className="mt-5 grid gap-4 lg:grid-cols-2">
              <DetailRow label="How did you hear about us" value={lead.hear_about_other || lead.hear_about_source} />
              <DetailRow label="Declaration accepted" value={lead.declaration_accepted ? "Yes" : "No"} />
              <DetailRow label="Coordinator notes" value={lead.notes} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationLeadTable({ leads, onCreateVoucher }) {
  const [selectedLead, setSelectedLead] = useState(null);

  if (!leads.length) {
    return (
      <section className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/25 bg-white/85 p-10 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">
        No registration records match the current filters.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] lg:block">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#F1EADC]">
            <thead className="bg-[#FAF7F0]/80">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#245C4F]">
                <th className="px-6 py-4">Child</th>
                <th className="px-6 py-4">Parent</th>
                <th className="px-6 py-4">Class</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1EADC]">
              {leads.map((lead, index) => {
                const displayStatus = getDisplayStatus(lead);
                const canCreateVoucher =
                  lead?.can_create_voucher === true ||
                  lead?.canCreateVoucher === true ||
                  lead?.status === "new_lead";

                return (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className="align-top"
                  >
                    <td className="px-6 py-5">
                      <p className="font-semibold text-[#063F32]">{lead.student_name}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">
                        {lead.gender || "Gender not provided"} • {formatDate(lead.date_of_birth)}
                      </p>
                      <p className="mt-1 text-sm text-[#245C4F]">{lead.current_school || "Current school not provided"}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-medium text-[#063F32]">{lead.parent_name || "Not provided"}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{lead.parent_relation || "Relation not set"}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{lead.city_country || "Location not provided"}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-medium text-[#063F32]">{lead.class_level || "Class not selected"}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{lead.program_name || "Programme not set"}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-[#063F32]">{lead.email || "No email"}</p>
                      <p className="mt-1 text-sm text-[#245C4F]">{lead.phone || "No phone"}</p>
                    </td>
                    <td className="px-6 py-5 text-sm text-[#245C4F]">{formatDateTime(lead.submitted_at)}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[displayStatus] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatStatus(displayStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedLead(lead)}
                        className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          View Details
                        </button>
                        {canCreateVoucher ? (
                          <button
                            type="button"
                            onClick={() => onCreateVoucher?.(lead)}
                            className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                          >
                            Create Voucher
                          </button>
                        ) : null}
                      </div>
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
              className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#063F32]">{lead.student_name}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">{lead.class_level}</p>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {lead.gender || "Gender not provided"} • {formatDate(lead.date_of_birth)}
                  </p>
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
                  <dt className="font-medium text-[#245C4F]">Parent</dt>
                  <dd className="mt-1 text-[#063F32]">{lead.parent_name || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#245C4F]">Contact</dt>
                  <dd className="mt-1 text-[#063F32]">{lead.email || lead.phone || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#245C4F]">Location</dt>
                  <dd className="mt-1 text-[#063F32]">{lead.city_country || "Not provided"}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[#245C4F]">Programme</dt>
                  <dd className="mt-1 text-[#063F32]">{lead.program_name || "Not provided"}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLead(lead)}
                  className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  View Details
                </button>
                {(lead?.can_create_voucher === true || lead?.canCreateVoucher === true || lead?.status === "new_lead") ? (
                  <button
                    type="button"
                    onClick={() => onCreateVoucher?.(lead)}
                    className="rounded-full bg-[#0D5C48] px-4 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]"
                  >
                    Create Voucher
                  </button>
                ) : null}
              </div>
            </motion.article>
          );
        })}
      </div>

      <LeadDetailsModal lead={selectedLead} onClose={() => setSelectedLead(null)} onCreateVoucher={onCreateVoucher} />
    </section>
  );
}
