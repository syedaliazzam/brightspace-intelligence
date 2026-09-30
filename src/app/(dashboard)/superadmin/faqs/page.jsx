"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const FAQ_CATEGORIES = [
  "All",
  "Dashboard",
  "Admissions",
  "Fees",
  "Payments",
  "Scholarship",
  "Documents",
  "Events",
  "Users",
  "Reports",
  "System",
];

const FAQS = [
  {
    category: "Dashboard",
    question: "What can I monitor from the super admin dashboard?",
    answer:
      "The super admin dashboard gives a complete operational overview of the LMS, including students, parents, admissions, fees, payments, events, learning content, assessments, users, and system activity.",
  },
  {
    category: "Dashboard",
    question: "How should I use the super admin portal daily?",
    answer:
      "Start from Dashboard, then review pending payments, admission activity, scholarship records, event registrations, user updates, and recent audit or system activity.",
  },
  {
    category: "Admissions",
    question: "Where can I review admission records?",
    answer:
      "Open Admission Records to review submitted admission forms, applicant details, uploaded documents, and admission progress across the LMS.",
  },
  {
    category: "Admissions",
    question: "Where can I track interested students?",
    answer:
      "Interested Students helps you monitor leads, interview progress, admission form status, and payment-related admission actions.",
  },
  {
    category: "Admissions",
    question: "Where are parent interview forms reviewed?",
    answer:
      "Parent Interview Forms show submitted parent responses. Super admins can review answers and monitor interview-related admission progress.",
  },
  {
    category: "Fees",
    question: "Where can I manage fee configuration?",
    answer:
      "Open Fee Management to manage regular fees, other fees, and related fee settings used by voucher and payment workflows.",
  },
  {
    category: "Fees",
    question: "Where can I review complete fee history?",
    answer:
      "Open Fee History to review student fee records, monthly fee details, admission fee, discounts, scholarships, paid amounts, pending dues, proofs, and voucher PDFs.",
  },
  {
    category: "Payments",
    question: "How are payments verified?",
    answer:
      "Open Payments, review the voucher, paid amount, transaction information, and proof file, then use the available actions to verify or manage the submission.",
  },
  {
    category: "Payments",
    question: "What should I confirm before approving a payment?",
    answer:
      "Confirm that the proof, paid amount, payer details, voucher number, and expected amount match before marking a payment as verified.",
  },
  {
    category: "Scholarship",
    question: "Where can I review scholarship records?",
    answer:
      "Open Scholarship to review need-based scholarship submissions, requested values, approved scholarship given amounts, voucher status, and verified or not verified records.",
  },
  {
    category: "Scholarship",
    question: "What does scholarship given amount mean?",
    answer:
      "Scholarship given amount is the approved scholarship value linked with the student or voucher. Where it is shown as display-only, it is for visibility and is not applied again in monthly calculations.",
  },
  {
    category: "Documents",
    question: "Where can I manage monthly plans?",
    answer:
      "Open Plan for Month to add, edit, preview, and manage class monthly plans, documents, images, and videos.",
  },
  {
    category: "Documents",
    question: "Where can I manage library records?",
    answer:
      "Open Library to upload and manage learning resources for classes and subjects. These records are used by relevant portals according to access rules.",
  },
  {
    category: "Documents",
    question: "Where can I manage educational documents?",
    answer:
      "Educational Documents is used for curriculum files, guides, and academic documents. Filters help find records by class, subject, and document details.",
  },
  {
    category: "Events",
    question: "Where can I review event registrations?",
    answer:
      "Open Event Registrations to review public event registration records, custom form responses, payment status, and verification details.",
  },
  {
    category: "Events",
    question: "Where can I manage events and schedules?",
    answer:
      "Use All Events Calendar for schedule visibility and event-related pages for registrations and public event workflows available in the portal.",
  },
  {
    category: "Users",
    question: "Where can I manage all LMS users?",
    answer:
      "Open User Management to manage staff, student, and parent accounts. Super admin access is intended for full user-management visibility.",
  },
  {
    category: "Users",
    question: "What should I check before changing a user account?",
    answer:
      "Check the user name, email, role, status, linked student or parent profile, class assignment, and portal access before saving changes.",
  },
  {
    category: "Reports",
    question: "Where are ECCE assessment reports reviewed?",
    answer:
      "Open ECCE Assessments to review assessment records, statuses, approvals, publishing, and report availability according to the ECCE workflow.",
  },
  {
    category: "Reports",
    question: "Where can I review system history?",
    answer:
      "Audit History helps super admins review important system activity and tracked changes where audit logging is available.",
  },
  {
    category: "System",
    question: "What should I do if a page does not show updated data?",
    answer:
      "Refresh the page first, then check filters and confirm the related record was saved successfully. If the issue remains, review the related source page or API behavior.",
  },
  {
    category: "System",
    question: "Can the FAQ page change system permissions?",
    answer:
      "No. The FAQ page only provides guidance. Permissions, roles, and portal access are controlled by user-management and backend authorization rules.",
  },
];

export default function SuperadminFaqsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);

  const filteredFaqs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return FAQS.filter((faq) => {
      const matchesCategory = category === "All" || faq.category === category;
      const matchesSearch = !search || `${faq.question} ${faq.answer} ${faq.category}`.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }, [category, query]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#063F32_0%,#0D5C48_52%,#2D8A6A_100%)] px-6 py-8 text-[#FAF7F0] shadow-[0_24px_80px_-40px_rgba(6,63,50,0.65)] sm:px-8 lg:px-10">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#E4C766]/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#FAF7F0]/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Super Admin Support
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Find quick answers about full LMS management, admissions, fees, payments, scholarships, documents, events, users, reports, and system workflows.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search questions</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setOpenIndex(null);
                }}
                placeholder="Search by question, topic, or keyword"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A]"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Filter by topic</span>
            <div className="relative">
              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setOpenIndex(null);
                }}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition hover:border-[#C79A3B]/70 hover:bg-[#FFF8E4] focus:border-[#2D8A6A]"
              >
                {FAQ_CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {filteredFaqs.length ? filteredFaqs.map((faq, index) => {
          const isOpen = openIndex === index;
          const displayNumber = String(index + 1).padStart(2, "0");
          return (
            <article key={`${faq.category}-${faq.question}`} className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white shadow-[0_16px_50px_-34px_rgba(13,59,46,0.26)]">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#FAF7F0] sm:px-6"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#EAF6EF] text-sm font-black text-[#0D5C48]">
                    {displayNumber}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#C79A3B]">{faq.category}</span>
                    <span className="mt-1 block text-base font-bold text-[#063F32] sm:text-lg">{faq.question}</span>
                  </span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-[#0D5C48] transition ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen ? (
                <div className="border-t border-[#2D8A6A]/10 bg-[#FFFCF5] px-5 py-4 sm:px-6">
                  <p className="text-sm leading-7 text-[#245C4F]">{faq.answer}</p>
                </div>
              ) : null}
            </article>
          );
        }) : (
          <div className="rounded-[1.5rem] border border-dashed border-[#2D8A6A]/25 bg-white p-8 text-center">
            <p className="font-semibold text-[#063F32]">No FAQs found.</p>
            <p className="mt-2 text-sm text-[#245C4F]">Try another search keyword or select a different topic.</p>
          </div>
        )}
      </section>
    </main>
  );
}
