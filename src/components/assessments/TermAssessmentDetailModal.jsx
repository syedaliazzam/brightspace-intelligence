"use client";

import React, { useEffect, useState } from "react";
import { X, Award, CheckCircle2, Download, RefreshCw } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
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

export default function TermAssessmentDetailModal({ item, onClose }) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadTermAssessmentPdf(item);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  }

  const records = Array.isArray(item.records)
    ? item.records
    : typeof item.records === "string"
      ? JSON.parse(item.records || "[]")
      : [];

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[10020] isolate flex min-h-screen items-center justify-center overflow-y-auto bg-[#063F32]/65 p-3 sm:p-6 backdrop-blur-md">
        <div className="relative my-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF7F0_100%)] shadow-[0_24px_80px_-24px_rgba(13,59,46,0.35)]">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 bg-white px-6 py-5 sm:px-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0D5C48]/30 bg-[#0D5C48]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                  Term Assessment
                </span>
                <span className="inline-flex rounded-full border border-[#E4C766]/40 bg-[#FFF5D6] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7A5E2B]">
                  {getAssessmentDisplayTerm(item)} ({item.academic_year || "Current Year"})
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#063F32]">
                {item.student_name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#245C4F]">
                {item.class_name && (
                  <span>
                    Class: <strong className="text-[#063F32]">{item.class_name}</strong>
                  </span>
                )}
                {item.admission_no && (
                  <span>
                    Roll No: <strong className="text-[#063F32]">{item.admission_no}</strong>
                  </span>
                )}
                {item.father_name && (
                  <span>
                    Father: <strong className="text-[#063F32]">{item.father_name}</strong>
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] transition hover:border-[#2D8A6A]/40 hover:bg-white active:scale-95 cursor-pointer shadow-2xs"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            {/* Performance Breakdown Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                    Performance Visualization
                  </p>
                  <h3 className="mt-0.5 text-lg font-bold text-[#063F32]">
                    Learning Areas Performance Breakdown
                  </h3>
                </div>
                <span className="rounded-full border border-[#2D8A6A]/20 bg-white px-3.5 py-1 text-xs font-semibold text-[#0D5C48] shadow-2xs">
                  {records.length} Subjects
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {records.map((area, idx) => {
                  const skills = area.skills || [];
                  const { chartData, badge } = getAreaChartData(skills);

                  return (
                    <PizzaPieChart
                      key={idx}
                      title={area.area_name}
                      subtitle={`${skills.length} Outcomes`}
                      badge={badge}
                      data={chartData}
                      size={160}
                    />
                  );
                })}
              </div>
            </div>

            {/* Detailed Outcomes Table */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                  Detailed Evaluation
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-[#063F32]">
                  Outcomes &amp; Teacher Observations
                </h3>
              </div>

              <div className="overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white shadow-2xs">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                    <tr>
                      <th className="px-5 py-3.5 font-bold">Learning Area</th>
                      <th className="px-5 py-3.5 font-bold">Skill / Learning Outcome</th>
                      <th className="px-5 py-3.5 font-bold">Score (%)</th>
                      <th className="px-5 py-3.5 font-bold">Teacher Observation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1EADC]">
                    {records.flatMap((area, aIdx) =>
                      (area.skills || []).map((skill, sIdx) => {
                        const obs = String(skill.observation || "").toLowerCase();
                        const isAchieved = obs.includes("achieve");
                        const isDeveloping = obs.includes("develop");

                        return (
                          <tr key={`${aIdx}-${sIdx}`} className="hover:bg-[#FAF7F0]/60 transition">
                            <td className="px-5 py-3 font-semibold text-[#063F32]">
                              {sIdx === 0 ? area.area_name : ""}
                            </td>
                            <td className="px-5 py-3 text-[#245C4F]">{skill.skill_name}</td>
                            <td className="px-5 py-3 font-bold text-[#0D5C48]">
                              {formatScore(skill.score)}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                  isAchieved
                                    ? "bg-[#EAF6EF] text-[#0D5C48] border border-[#2D8A6A]/20"
                                    : isDeveloping
                                      ? "bg-[#FFF5D6] text-[#7A5E2B] border border-[#C9A227]/30"
                                      : "bg-[#F1EADC] text-[#063F32] border border-[#2D8A6A]/10"
                                }`}
                              >
                                {isAchieved && <CheckCircle2 className="h-3 w-3" />}
                                {skill.observation}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Teacher Remarks Box */}
            {item.teacher_remarks && (
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FFF5D6]/35 p-5">
                <div className="flex items-center gap-2 mb-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#0D5C48]">
                  <Award className="h-4 w-4" />
                  <span>Teacher Observations &amp; Remarks</span>
                </div>
                <p className="text-sm text-[#245C4F] leading-relaxed">
                  {item.teacher_remarks}
                </p>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end border-t border-[#2D8A6A]/10 bg-white px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D5C48] px-6 py-2.5 text-xs font-bold text-[#FAF7F0] shadow-xs transition hover:bg-[#063F32] hover:shadow-md active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {downloading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#FAF7F0]" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#FAF7F0]" />
              )}
              <span>{downloading ? "Preparing PDF..." : "Download Report"}</span>
            </button>
          </div>
        </div>
      </div>
    </ClientPortal>
  );
}
