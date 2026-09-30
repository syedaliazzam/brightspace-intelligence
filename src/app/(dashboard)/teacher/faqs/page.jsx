"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const FAQ_CATEGORIES = [
  "All",
  "Dashboard",
  "Lectures",
  "Attendance",
  "Homework",
  "ECCE",
  "Library",
  "Notes",
  "Profile",
];

const FAQS = [
  {
    category: "Dashboard",
    question: "What can I see on the teacher dashboard?",
    answer:
      "The teacher dashboard gives you a quick overview of your assigned classes, upcoming lectures, homework activity, attendance-related work, notes, and important teaching updates in one place. It is designed as the starting point for your daily teaching workflow.",
  },
  {
    category: "Dashboard",
    question: "How should I start my daily work from the teacher portal?",
    answer:
      "Start from the Dashboard to review upcoming lectures and recent activity. Then open Lectures for class timing, Attendance after the lecture is conducted, Homework for assigned tasks, and Notes if you need to review communication or student-related updates.",
  },
  {
    category: "Lectures",
    question: "How do I view my assigned lectures?",
    answer:
      "Open the Lectures page from the sidebar. You can view lecture title, class, subject, date, time, schedule status, and joining information for lectures assigned to your teacher account.",
  },
  {
    category: "Lectures",
    question: "Why is a lecture not visible in my portal?",
    answer:
      "A lecture appears only when it is assigned to your teacher profile and related class or subject. If it is missing, contact the coordinator to verify the lecture schedule and assignment.",
  },
  {
    category: "Attendance",
    question: "How do I mark student attendance?",
    answer:
      "Go to Attendance, select the assigned class, subject, and lecture, then mark each student attendance status. Review the roster carefully before saving so the correct lecture attendance is recorded.",
  },
  {
    category: "Attendance",
    question: "When should I save or update attendance?",
    answer:
      "Attendance should be saved after the lecture is conducted and the student list is reviewed. If you notice a mistake later, open the same class, subject, and lecture again, update the student status, and save the changes.",
  },
  {
    category: "Attendance",
    question: "Why are some subjects not showing in attendance?",
    answer:
      "Subjects are shown according to your assigned classes and teaching schedule. If a subject is missing, it may not be assigned to you for that class or may not have a related lecture schedule.",
  },
  {
    category: "Homework",
    question: "How do I create homework?",
    answer:
      "Open the Homework page, choose the relevant class and subject, enter the homework title, details, due date, and any supporting instructions or files, then submit it so students can view and complete the task.",
  },
  {
    category: "Homework",
    question: "How do I review submitted homework?",
    answer:
      "Use the Approve Homework page to view student submissions. You can review submitted work, check attachments, and update the approval status where required.",
  },
  {
    category: "Homework",
    question: "What should I check before approving homework?",
    answer:
      "Before approving homework, check the submitted files or written response, confirm it belongs to the correct task and student, and review whether the submission meets the expected instructions. If something is missing, follow the available status or feedback process used by your portal.",
  },
  {
    category: "ECCE",
    question: "How do I submit an ECCE assessment?",
    answer:
      "Open ECCE Assessments, select the class and student, complete the required student information and section-wise ratings, add teacher remarks, then submit the assessment for coordinator review.",
  },
  {
    category: "ECCE",
    question: "Can I edit an ECCE assessment after submission?",
    answer:
      "After submission, the assessment is locked unless the coordinator requests a correction. If correction is requested, you can update the assessment and resubmit it.",
  },
  {
    category: "ECCE",
    question: "What should I complete before submitting an ECCE assessment?",
    answer:
      "Complete the student information section, attendance values, section-wise MT and FT ratings, subject-wise performance where required, and teacher remarks. Review each section before submitting because the report goes to the coordinator for review.",
  },
  {
    category: "ECCE",
    question: "Where can I view submitted ECCE assessment records?",
    answer:
      "Open ECCE Assessment Records from the teacher sidebar. This page shows submitted, approved, returned, and published assessment records available to you.",
  },
  {
    category: "ECCE",
    question: "What happens after the coordinator approves an ECCE assessment?",
    answer:
      "After approval, the assessment becomes locked for official reporting. Once published, the report can become available to the parent and student portals according to the LMS workflow.",
  },
  {
    category: "Library",
    question: "How do I use the library page?",
    answer:
      "The Library page shows class and subject learning resources available for your assigned teaching areas. You can use filters to quickly find documents, videos, or other resources.",
  },
  {
    category: "Library",
    question: "Why do I only see some library documents?",
    answer:
      "Library resources are shown according to your assigned classes and subjects. If a document is not visible, it may belong to another class, another subject, or may not be active for your teaching assignment.",
  },
  {
    category: "Notes",
    question: "How do teacher notes work?",
    answer:
      "The Notes page helps you communicate or track student-related notes. You can use it to view and manage relevant note threads according to your access.",
  },
  {
    category: "Notes",
    question: "When should I use notes?",
    answer:
      "Use notes for student-related follow-ups, learning observations, reminders, or communication that should remain organized inside the LMS. Notes help keep teacher communication connected with the relevant student or class context.",
  },
  {
    category: "Profile",
    question: "Where can I check my teacher profile details?",
    answer:
      "Open Profile from the sidebar to view your account and teacher information. If any information is incorrect, contact the coordinator or admin team.",
  },
  {
    category: "Profile",
    question: "What should I do if my assigned class or subject is incorrect?",
    answer:
      "If your assigned class, subject, lecture, or student list looks incorrect, contact the coordinator. Teacher assignments are managed by the coordinator or admin team, and the portal shows data based on those assignments.",
  },
  {
    category: "Dashboard",
    question: "What should I do if data does not look updated?",
    answer:
      "Refresh the page first. If the issue remains, confirm that the class, subject, or lecture was assigned correctly by the coordinator.",
  },
  {
    category: "Lectures",
    question: "Can I access events and class schedules from the teacher portal?",
    answer:
      "Yes. The All Events Calendar page shows relevant scheduled events and class activities so you can review your teaching calendar from one place.",
  },
  {
    category: "Lectures",
    question: "What does the lecture status mean?",
    answer:
      "Lecture status helps you understand the current stage of the lecture, such as upcoming, completed, verified, or requiring action. The exact status depends on the schedule and coordinator verification workflow.",
  },
  {
    category: "Attendance",
    question: "Why is the lecture list loading after I select class and subject?",
    answer:
      "The lecture list depends on the selected class and subject. The portal loads the matching lecture records so you mark attendance against the correct conducted lecture instead of the wrong schedule.",
  },
  {
    category: "Homework",
    question: "Can students submit files for homework?",
    answer:
      "Yes, if the homework submission supports files, students can upload their work. Teachers can review the submitted documents or images from the homework approval area.",
  },
  {
    category: "Library",
    question: "How do I open a library document?",
    answer:
      "Open the Library page, find the required resource, and click the document link or preview action. Documents should open in a new tab or viewer depending on the file type and browser support.",
  },
  {
    category: "Profile",
    question: "Can I change my own role or portal access?",
    answer:
      "No. Role and portal access are managed by the admin or coordinator team. If you need access changes, request them from the management team.",
  },
];

export default function TeacherFaqsPage() {
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
            Teacher Support
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
            Find quick answers about lectures, attendance, homework, ECCE assessments, library resources, notes, and profile usage in the teacher portal.
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
