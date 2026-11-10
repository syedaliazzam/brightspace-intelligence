"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ClipboardCheck,
  GraduationCap,
  Award,
  ChevronDown,
  Download,
} from "lucide-react";
import PizzaPieChart, { getAreaChartData } from "@/components/assessments/PizzaPieChart";
import { downloadTermAssessmentPdf, getAssessmentDisplayTerm } from "@/lib/termAssessmentPdf";

function formatScore(rawScore) {
  const num = Number(rawScore);
  if (isNaN(num)) return "0%";
  if (num > 0 && num <= 1) {
    return `${Math.round(num * 100)}%`;
  }
  return `${Math.round(num)}%`;
}

export default function TermAssessmentsView({
  portal = "parent",
  hideHero = false,
  activeTab = "term",
  setActiveTab,
}) {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  const [internalTab, setInternalTab] = useState("term");
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadPdf(assessment) {
    if (!assessment) return;
    try {
      setDownloading(true);
      await downloadTermAssessmentPdf(assessment);
    } catch (err) {
      console.error("Failed to download PDF report:", err);
    } finally {
      setDownloading(false);
    }
  }

  const currentTab = activeTab || internalTab;
  const handleTabChange = (val) => {
    if (setActiveTab) {
      setActiveTab(val);
    } else {
      setInternalTab(val);
    }
  };

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/term-assessments/records");
      const data = await res.json();
      if (res.ok && data.assessments) {
        setAssessments(data.assessments);
        if (portal === "student" && data.assessments.length > 0) {
          setSelectedAssessmentId(data.assessments[0].id);
        } else if (data.assessments.length === 1) {
          setSelectedAssessmentId(data.assessments[0].id);
        } else {
          // Default no child selected if multiple available for parent
          setSelectedAssessmentId("");
        }
      }
    } catch (err) {
      console.error("Error fetching term assessments:", err);
    } finally {
      setLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecords();
  }, [fetchRecords]);

  // If student portal, default to first assessment if none selected; otherwise if 1 available, auto-select it; if multiple for parent, require manual selection
  const activeAssessment = (portal === "student" && !selectedAssessmentId && assessments.length > 0)
    ? assessments[0]
    : assessments.length === 1
      ? assessments[0]
      : assessments.find((a) => a.id === selectedAssessmentId) || null;

  const recordsList = activeAssessment
    ? Array.isArray(activeAssessment.records)
      ? activeAssessment.records
      : typeof activeAssessment.records === "string"
        ? JSON.parse(activeAssessment.records || "[]")
        : []
    : [];

  const portalLabel = portal === "parent" ? "Parent portal" : "Student portal";

  return (
    <div className="space-y-6 text-[#063F32]">
      {/* Hero Header Section (Optional / Standalone only) */}
      {!hideHero && (
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Term Assessment Reports
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
                Review published learning outcomes, progress status, and subject performance breakdown.
              </p>
            </div>

            {activeAssessment && (
              <div className="flex flex-col gap-3 lg:items-end">
                <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                    <p className="font-semibold text-lg">{recordsList.length}</p>
                    <p className="text-xs text-[#EAF6EF]">Learning Areas</p>
                  </div>
                  <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                    <p className="font-semibold text-lg">{getAssessmentDisplayTerm(activeAssessment)}</p>
                    <p className="text-xs text-[#EAF6EF]">{activeAssessment.academic_year}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 1. Unified Filter Box (Assessment Type & Student Name in ONE box) */}
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Filter: Assessment Type */}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              Assessment Type
            </span>
            <div className="relative">
              <select
                value={currentTab}
                onChange={(e) => handleTabChange(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 cursor-pointer shadow-2xs"
              >
                <option value="term">Term Assessment</option>
                <option value="ecce">ECCE Assessment</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
          </label>

          {/* Filter: Student Name / Assessment Report */}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              {portal === "student" ? "Assessment Report / Term" : "Student Name"}
            </span>
            <div className="relative">
              <select
                value={selectedAssessmentId || (portal === "student" && assessments.length > 0 ? assessments[0].id : "")}
                onChange={(e) => setSelectedAssessmentId(e.target.value)}
                disabled={loading || assessments.length === 0}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#2D8A6A]/10 cursor-pointer shadow-2xs disabled:bg-gray-100 disabled:text-gray-400"
              >
                {assessments.length === 0 ? (
                  <option value="">No reports available</option>
                ) : portal === "student" ? (
                  assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {getAssessmentDisplayTerm(a)} ({a.academic_year})
                    </option>
                  ))
                ) : assessments.length === 1 ? (
                  <option value={assessments[0].id}>
                    {assessments[0].student_name} {assessments[0].class_name ? `• ${assessments[0].class_name}` : ""}
                  </option>
                ) : (
                  <>
                    <option value="">-- Select Child --</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.student_name} {a.class_name ? `• ${a.class_name}` : ""} • {getAssessmentDisplayTerm(a)} ({a.academic_year})
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
          </label>
        </div>
      </section>

      {/* 2. Details Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 rounded-[2rem] bg-white border border-[#2D8A6A]/15">
          <RefreshCw className="h-6 w-6 animate-spin text-[#0D5C48]" />
          <span className="ml-2.5 text-sm font-semibold text-[#063F32]">
            Loading term assessments...
          </span>
        </div>
      ) : assessments.length === 0 ? (
        <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-12 text-center shadow-xs">
          <ClipboardCheck className="mx-auto h-12 w-12 text-[#2D8A6A]/40" />
          <h3 className="mt-3 text-base font-bold text-[#063F32]">No Term Assessment Available Yet</h3>
          <p className="mt-1 text-xs text-[#245C4F] max-w-md mx-auto">
            Once your coordinator publishes the term assessment report, your performance breakdown charts will appear here.
          </p>
        </div>
      ) : !activeAssessment ? (
        <div className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-12 text-center shadow-xs">
          <GraduationCap className="mx-auto h-12 w-12 text-[#2D8A6A]/50" />
          <h3 className="mt-3 text-base font-bold text-[#063F32]">
            {portal === "student" ? "Please Select a Report" : "Please Select a Child"}
          </h3>
          <p className="mt-1 text-xs text-[#245C4F] max-w-md mx-auto">
            {portal === "student"
              ? "Please choose an assessment report from the dropdown above to view your learning areas performance breakdown."
              : "Please choose a student from the dropdown above to view their term assessment report and learning areas performance breakdown."}
          </p>
        </div>
      ) : (
        /* Unified Report Details Box (All details inside ONE box) */
        <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.98))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)]">
          {/* Part 1: Student Profile Header */}
          <div className="border-b border-[#2D8A6A]/10 bg-[#FAF7F0]/60 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white border border-[#2D8A6A]/20 text-[#0D5C48] shadow-xs">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#063F32]">
                    {activeAssessment.student_name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#245C4F]">
                    <span>Class: <strong className="text-[#063F32]">{activeAssessment.class_name}</strong></span>
                    {activeAssessment.admission_no && (
                      <span>Roll No: <strong className="text-[#063F32]">{activeAssessment.admission_no}</strong></span>
                    )}
                    {activeAssessment.father_name && (
                      <span>Father: <strong className="text-[#063F32]">{activeAssessment.father_name}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(activeAssessment)}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-xs font-bold text-[#0D5C48] shadow-2xs transition hover:border-[#2D8A6A]/50 hover:bg-[#FAF7F0] active:scale-95 cursor-pointer disabled:opacity-60"
                  title="Download Assessment Report as PDF"
                >
                  {downloading ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-[#0D5C48]" />
                  ) : (
                    <Download className="h-4 w-4 text-[#0D5C48]" />
                  )}
                  <span>{downloading ? "Preparing PDF..." : "Download Report"}</span>
                </button>

                <div className="rounded-2xl border border-[#2D8A6A]/15 bg-white px-5 py-3 text-left shadow-2xs">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">
                    Assessment Term
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-[#063F32]">
                    {getAssessmentDisplayTerm(activeAssessment)} ({activeAssessment.academic_year})
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Part 2: Performance Visualization (Charts) */}
          <div className="border-b border-[#2D8A6A]/10 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                  Performance Visualization
                </p>
                <h3 className="mt-1 text-xl font-bold text-[#063F32]">
                  Learning Areas Performance Breakdown
                </h3>
              </div>
              <span className="rounded-full border border-[#2D8A6A]/20 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0D5C48] shadow-2xs">
                {recordsList.length} Subjects
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {recordsList.map((area, idx) => {
                const skills = area.skills || [];
                const { chartData, badge } = getAreaChartData(skills);

                return (
                  <PizzaPieChart
                    key={idx}
                    title={area.area_name}
                    subtitle={`${skills.length} Outcomes`}
                    badge={badge}
                    data={chartData}
                    size={170}
                  />
                );
              })}
            </div>
          </div>

          {/* Part 3: Detailed Evaluation Table & Remarks */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                  Detailed Evaluation
                </p>
                <h3 className="mt-1 text-xl font-bold text-[#063F32]">
                  Outcomes &amp; Teacher Observations
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white shadow-2xs">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                  <tr>
                    <th className="px-6 py-4 font-bold">Learning Area</th>
                    <th className="px-6 py-4 font-bold">Skill / Learning Outcome</th>
                    <th className="px-6 py-4 font-bold">Score (%)</th>
                    <th className="px-6 py-4 font-bold">Teacher Observation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1EADC]">
                  {recordsList.flatMap((area, aIdx) =>
                    (area.skills || []).map((skill, sIdx) => (
                      <tr key={`${aIdx}-${sIdx}`} className="hover:bg-[#FAF7F0]/60 transition">
                        <td className="px-6 py-4 font-semibold text-[#063F32]">
                          {sIdx === 0 ? area.area_name : ""}
                        </td>
                        <td className="px-6 py-4 text-[#245C4F]">{skill.skill_name}</td>
                        <td className="px-6 py-4 font-bold text-[#0D5C48]">{formatScore(skill.score)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${String(skill.observation || "")
                                .toLowerCase()
                                .includes("achieve")
                                ? "bg-[#EAF6EF] text-[#0D5C48]"
                                : "bg-[#F1EADC] text-[#7A5E2B]"
                              }`}
                          >
                            {skill.observation}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Teacher Remarks Box */}
            {activeAssessment.teacher_remarks && (
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FFF5D6]/35 p-5">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                  <Award className="h-4 w-4" />
                  <span>Teacher Observations &amp; Remarks</span>
                </div>
                <p className="text-sm text-[#245C4F] leading-relaxed">
                  {activeAssessment.teacher_remarks}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
