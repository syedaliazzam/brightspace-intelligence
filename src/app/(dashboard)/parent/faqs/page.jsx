"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const AUDIENCE_FILTERS = ["All", "Parent FAQs", "Student FAQs"];
const TOPIC_FILTERS = [
  "All",
  "Dashboard",
  "Lectures",
  "Homework",
  "Attendance",
  "Reports",
  "Library",
  "Notes",
  "Fees",
  "Profile",
];

const FAQS = [
  {
    audience: "Parent FAQs",
    category: "Dashboard",
    question: "What can I see on the parent dashboard?",
    answer:
      "The parent dashboard gives you a quick overview of your child learning activity, upcoming lectures, homework, attendance summary, fee alerts, notes, and important updates in one place.",
  },
  {
    audience: "Parent FAQs",
    category: "Dashboard",
    question: "How do I switch or check information for my child?",
    answer:
      "Parent portal information is connected with your linked child records. If your account has more than one child, use the available class or child-related filters on pages where they are provided. If a child is missing, contact the coordinator.",
  },
  {
    audience: "Parent FAQs",
    category: "Lectures",
    question: "How can I view my child upcoming lectures?",
    answer:
      "Open Lectures from the sidebar to view lecture schedule, class information, subject, date, time, and joining details available for your child class.",
  },
  {
    audience: "Parent FAQs",
    category: "Homework",
    question: "Where can I check homework assigned to my child?",
    answer:
      "Open Homework from the parent sidebar. You can review assigned homework, due dates, teacher instructions, and submission-related status for your child.",
  },
  {
    audience: "Parent FAQs",
    category: "Attendance",
    question: "How can I review my child attendance?",
    answer:
      "Open Attendance from the sidebar to review conducted lecture attendance, absence records, and attendance percentage. This helps you monitor regular participation.",
  },
  {
    audience: "Parent FAQs",
    category: "Reports",
    question: "Where are ECCE assessment reports shown?",
    answer:
      "Open Assessment Reports to view published ECCE assessment reports for your child. Reports are shown only after teacher submission, coordinator approval, and publishing.",
  },
  {
    audience: "Parent FAQs",
    category: "Library",
    question: "How do library resources work in the parent portal?",
    answer:
      "The Library page shows learning resources and documents available for your child class. You can filter by class, subject, or date where options are available.",
  },
  {
    audience: "Parent FAQs",
    category: "Notes",
    question: "What are notes used for in the parent portal?",
    answer:
      "Notes help you follow important communication and learning updates related to your child. Use this page to review relevant message threads and observations.",
  },
  {
    audience: "Parent FAQs",
    category: "Fees",
    question: "Where can I check fee information?",
    answer:
      "Open Fees to view fee alerts, voucher status, due information, and payment-related updates for your child. If a payment looks incorrect, contact the coordinator with voucher details.",
  },
  {
    audience: "Parent FAQs",
    category: "Fees",
    question: "Why does a fee alert show even after payment?",
    answer:
      "Fee alerts depend on voucher submission and coordinator verification. If you already submitted payment, wait for verification or contact the coordinator if the alert does not update.",
  },
  {
    audience: "Parent FAQs",
    category: "Profile",
    question: "Where can I check my parent profile?",
    answer:
      "Open Profile from the sidebar to view account and parent information. If personal details are incorrect, contact the coordinator or admin team for correction.",
  },
  {
    audience: "Student FAQs",
    category: "Dashboard",
    question: "What should my child use the student dashboard for?",
    answer:
      "The student dashboard helps the child quickly access lectures, homework, attendance, learning resources, notes, and assessment reports from one place.",
  },
  {
    audience: "Student FAQs",
    category: "Lectures",
    question: "How does my child join a lecture?",
    answer:
      "The child can open the student Lectures page or dashboard lecture section and use the available class joining link when the lecture is active and allowed by the LMS timing rules.",
  },
  {
    audience: "Student FAQs",
    category: "Homework",
    question: "How does my child submit homework?",
    answer:
      "The child opens Homework, selects the assigned task, follows the instructions, attaches required work if needed, and submits before or according to the due date.",
  },
  {
    audience: "Student FAQs",
    category: "Attendance",
    question: "Can my child see their attendance?",
    answer:
      "Yes. The student portal shows attendance information so the child can understand their lecture participation and attendance progress.",
  },
  {
    audience: "Student FAQs",
    category: "Reports",
    question: "Can my child download assessment reports?",
    answer:
      "Published ECCE assessment reports can be viewed from the student portal. Download availability depends on the report status and LMS permissions.",
  },
  {
    audience: "Student FAQs",
    category: "Library",
    question: "How should my child use learning resources?",
    answer:
      "The child can open Library or Learning Resources to access class materials, documents, videos, and guides shared for their enrolled class and subjects.",
  },
  {
    audience: "Student FAQs",
    category: "Notes",
    question: "What should my child do with notes?",
    answer:
      "Notes can include teacher updates, reminders, or learning observations. The child should review notes regularly and follow any guidance shared by the teacher.",
  },
  {
    audience: "Student FAQs",
    category: "Profile",
    question: "What if my child profile information is incorrect?",
    answer:
      "If the student name, class, profile information, or account details are incorrect, the parent should contact the coordinator or admin team for correction.",
  },
];

export default function ParentFaqsPage() {
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("All");
  const [topic, setTopic] = useState("All");
  const [openIndex, setOpenIndex] = useState(null);

  const filteredFaqs = useMemo(() => {
    const search = query.trim().toLowerCase();
    return FAQS.filter((faq) => {
      const matchesAudience = audience === "All" || faq.audience === audience;
      const matchesTopic = topic === "All" || faq.category === topic;
      const matchesSearch = !search || `${faq.question} ${faq.answer} ${faq.category} ${faq.audience}`.toLowerCase().includes(search);
      return matchesAudience && matchesTopic && matchesSearch;
    });
  }, [audience, query, topic]);

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#063F32_0%,#0D5C48_52%,#2D8A6A_100%)] px-6 py-8 text-[#FAF7F0] shadow-[0_24px_80px_-40px_rgba(6,63,50,0.65)] sm:px-8 lg:px-10">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#E4C766]/20 blur-3xl" />
        <div className="absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-[#FAF7F0]/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
            Parent Support
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Find quick answers for parent portal usage and student portal guidance, including lectures, homework, attendance, reports, fees, library, notes, and profile support.
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_240px_240px]">
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
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">FAQ type</span>
            <div className="relative">
              <select
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value);
                  setOpenIndex(null);
                }}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition hover:border-[#C79A3B]/70 hover:bg-[#FFF8E4] focus:border-[#2D8A6A]"
              >
                {AUDIENCE_FILTERS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Filter by topic</span>
            <div className="relative">
              <select
                value={topic}
                onChange={(event) => {
                  setTopic(event.target.value);
                  setOpenIndex(null);
                }}
                className="w-full cursor-pointer appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition hover:border-[#C79A3B]/70 hover:bg-[#FFF8E4] focus:border-[#2D8A6A]"
              >
                {TOPIC_FILTERS.map((item) => (
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
            <article key={`${faq.audience}-${faq.category}-${faq.question}`} className="overflow-hidden rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white shadow-[0_16px_50px_-34px_rgba(13,59,46,0.26)]">
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
                    <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#C79A3B]">
                      {faq.audience} / {faq.category}
                    </span>
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
            <p className="mt-2 text-sm text-[#245C4F]">Try another search keyword or select a different FAQ type or topic.</p>
          </div>
        )}
      </section>
    </main>
  );
}
