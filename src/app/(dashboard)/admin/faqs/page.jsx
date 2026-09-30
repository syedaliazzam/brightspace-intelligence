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
    question: "What can I monitor from the admin dashboard?",
    answer:
      "The admin dashboard gives a quick view of operational activity such as students, parents, admissions, payments, events, learning resources, and important LMS updates.",
  },
  {
    category: "Dashboard",
    question: "What should I check first when opening the admin portal?",
    answer:
      "Start with the dashboard summary, then review pending admissions, payment submissions, scholarship records, event registrations, and any recently updated learning content.",
  },
  {
    category: "Admissions",
    question: "Where can I review admission records?",
    answer:
      "Open Admission Records to view submitted admission forms, applicant details, documents, and the current admission status.",
  },
  {
    category: "Admissions",
    question: "Where are interested students managed?",
    answer:
      "Interested Students is used to track leads, parent interview status, admission form progress, and payment-related admission steps according to the configured workflow.",
  },
  {
    category: "Admissions",
    question: "How do parent interview forms work?",
    answer:
      "Parent Interview Forms show submitted interview responses. Admin users can review answers, verify details, and follow the next admission steps where available.",
  },
  {
    category: "Fees",
    question: "Where can I review fee history?",
    answer:
      "Open Fee History to review student fee records, monthly fee details, admission fee values, discounts, scholarships, paid amounts, pending dues, payment proofs, and voucher PDFs.",
  },
  {
    category: "Fees",
    question: "Where are fee settings managed?",
    answer:
      "Fee Management contains fee setup areas such as regular fees, other fees, and related fee configuration used across fee vouchers and payment workflows.",
  },
  {
    category: "Payments",
    question: "How do I verify payment submissions?",
    answer:
      "Open Payments, review the submitted proof and payment details, then use the available action buttons to verify or handle the payment according to the school process.",
  },
  {
    category: "Payments",
    question: "Why should I check the payment proof before approval?",
    answer:
      "Payment proof confirms whether the submitted transaction matches the expected voucher amount, payer information, and payment method before marking it verified.",
  },
  {
    category: "Scholarship",
    question: "Where can I review scholarship requests?",
    answer:
      "Open Scholarship to review need-based scholarship forms, requested amounts, approved scholarship given amounts, and voucher-related scholarship information.",
  },
  {
    category: "Scholarship",
    question: "What does scholarship given amount mean?",
    answer:
      "Scholarship given amount is the approved scholarship value linked with a student or voucher. Where shown as display-only, it is informational and is not used again for monthly fee calculation.",
  },
  {
    category: "Documents",
    question: "Where can I manage monthly plan files?",
    answer:
      "Open Plan for Month to add, edit, preview, or manage monthly plan documents, images, and videos according to class and subject requirements.",
  },
  {
    category: "Documents",
    question: "Where can I manage library resources?",
    answer:
      "Open Library to upload and manage learning resources. Library records can be connected with classes and subjects so the correct portals can display relevant files.",
  },
  {
    category: "Documents",
    question: "Where are educational documents managed?",
    answer:
      "Educational Documents is used for curriculum, guides, and other academic resources. Use the available filters to find records by class, subject, or document type.",
  },
  {
    category: "Events",
    question: "Where can I manage public event registrations?",
    answer:
      "Open Event Registrations to review public event participants, registration information, payment status, custom event form responses, and verification details.",
  },
  {
    category: "Events",
    question: "Where can I view all scheduled events?",
    answer:
      "All Events Calendar shows scheduled activities and class events in calendar form so admins can monitor upcoming and completed events.",
  },
  {
    category: "Users",
    question: "Where can I manage staff, students, and parents?",
    answer:
      "Open User Management and choose Staff Management, Students Management, or Parents Management to review and manage account records according to your access.",
  },
  {
    category: "Users",
    question: "What should I check before updating a user account?",
    answer:
      "Confirm the user name, email, role, status, linked student or parent profile, and class information before saving account changes.",
  },
  {
    category: "Reports",
    question: "Where can I review ECCE assessments?",
    answer:
      "Open ECCE Assessments to review student assessment records and their workflow status. Approved and published reports become available according to the assessment process.",
  },
  {
    category: "Reports",
    question: "Can admins view audit history?",
    answer:
      "Yes. Audit History helps review important system activity and changes where audit tracking is available.",
  },
  {
    category: "System",
    question: "What should I do if data does not look updated?",
    answer:
      "Refresh the page first. If it still looks incorrect, confirm that the related record was saved successfully and check whether the page filter is limiting the visible records.",
  },
  {
    category: "System",
    question: "Can I change portal permissions from the FAQ page?",
    answer:
      "No. The FAQ page is only for guidance. Role access and permissions are managed through the LMS user and role configuration.",
  },
];

export default function AdminFaqsPage() {
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
            Admin Support
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Find quick answers about admissions, payments, scholarships, documents, events, users, reports, and system workflows in the admin portal.
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
