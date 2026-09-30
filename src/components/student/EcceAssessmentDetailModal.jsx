"use client";

import { useEffect, useState } from "react";
import { X, Download, RefreshCw } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import { ECCE_SECTIONS } from "@/lib/ecceAssessmentTemplate";
import { mainHeadingForSection, responseKey, pairCriteria, downloadAssessmentPdf } from "@/lib/ecceAssessmentPdf";

export default function EcceAssessmentDetailModal({ item, onClose }) {
  const [imageLoaded, setImageLoaded] = useState(false);
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

  const sections = item.sections?.length ? item.sections : ECCE_SECTIONS;

  async function handleDownloadReport() {
    try {
      setDownloading(true);
      await downloadAssessmentPdf(item, sections);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    } finally {
      setDownloading(false);
    }
  }
  const studentInfo = item.responses?.__studentInfo || {};
  const remarks = item.responses?.__remarks || {};
  const signatures = item.responses?.__signatures || {};
  const subjectPerf = Array.isArray(item.subject_performance) ? item.subject_performance : [];

  const studentName = studentInfo.studentName || item.student_name || "Student";
  const fatherName = studentInfo.fatherName || item.father_name || "—";
  const className = studentInfo.className || item.class_name || "—";
  const rollNo = studentInfo.rollNo || item.admission_no || "—";
  const age = studentInfo.age || item.age || "—";
  const academicYear = studentInfo.academicYear || item.academic_year || "Current Year";
  const term = studentInfo.term || item.term || "Term Assessment";
  const td = studentInfo.attendanceTd || item.attendance?.total || "—";
  const pd = studentInfo.attendancePd || item.attendance?.present || "—";
  const photoUrl = item.profile_picture_url ||
    (studentInfo.picturePath && (/^https?:\/\//i.test(studentInfo.picturePath) || studentInfo.picturePath.startsWith("data:") || studentInfo.picturePath.startsWith("blob:")) ? studentInfo.picturePath : "") ||
    (studentInfo.picturePath ? `/api/file-preview?path=${encodeURIComponent(studentInfo.picturePath)}` : "") ||
    (item.profile_picture_path && (/^https?:\/\//i.test(item.profile_picture_path) || item.profile_picture_path.startsWith("data:") || item.profile_picture_path.startsWith("blob:")) ? item.profile_picture_path : "") ||
    (item.profile_picture_path ? `/api/file-preview?path=${encodeURIComponent(item.profile_picture_path)}` : "");

  return (
    <ClientPortal>
      <div className="fixed inset-0 z-[9999] isolate flex min-h-screen items-start justify-center overflow-y-auto bg-[#063F32]/65 p-3 sm:p-6 backdrop-blur-md">
        <div className="my-auto flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(180deg,#FFFFFF_0%,#FAF7F0_100%)] shadow-[0_24px_80px_-24px_rgba(13,59,46,0.35)]">
          {/* Modal Header Bar */}
          <div className="flex items-start min-[600px]:items-center justify-between border-b border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 sm:px-6 sm:py-4 gap-3">
            <div className="flex flex-col min-[600px]:flex-row min-[600px]:items-center gap-1.5 min-[600px]:gap-3">
              <h2 className="text-base sm:text-xl font-black text-[#063F32] order-1 min-[600px]:order-2">
                {studentName} — ECCE Assessment Report
              </h2>
              <span className="inline-block w-fit rounded-full bg-[#0F4C3A] px-2.5 py-0.5 min-[600px]:px-3 min-[600px]:py-1 text-[11px] min-[600px]:text-xs font-black uppercase tracking-[0.15em] text-white order-2 min-[600px]:order-1">
                {item.status || "PUBLISHED"}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#2D8A6A]/20 bg-white text-[#0D5C48] shadow-xs transition hover:bg-[#F1EADC] active:scale-95 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Content — Single Unified Scroll Container for the entire report */}
          <div className="flex-1 overflow-auto p-4 sm:p-7 text-[#063F32] [scrollbar-width:thin]">
            <div className="min-w-[680px] md:min-w-0 space-y-6">
              {/* Header Banner */}
              <div className="rounded-[1.25rem] bg-[linear-gradient(135deg,#0F4C3A_0%,#0B3D30_100%)] p-6 text-white shadow-md">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#F7E7A9]">Ash-Shajrah Learning Hub</h1>
                    <p className="mt-1 text-base sm:text-lg font-extrabold text-white">Early Childhood Care &amp; Education (ECCE) Assessment Report</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-sm font-black text-[#E4C766]">{term}</p>
                    <p className="text-xs text-white/80">Academic Year: {academicYear}</p>
                  </div>
                </div>
              </div>

            {/* Student Info Card - Photo on Left */}
            <div className="flex flex-col gap-5 rounded-[1.25rem] border border-[#2D8A6A]/20 bg-white p-5 shadow-xs sm:flex-row sm:items-center">
              {photoUrl ? (
                <div className="relative h-32 w-28 shrink-0 overflow-hidden rounded-xl border-2 border-[#0F4C3A] bg-[#EFECE4] shadow-xs">
                  {!imageLoaded && (
                    <div className="absolute inset-0 animate-pulse bg-[linear-gradient(135deg,#EFECE4_0%,#DFD9C9_100%)]" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt={studentName}
                    loading="eager"
                    decoding="async"
                    onLoad={() => setImageLoaded(true)}
                    className={`h-full w-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
                  />
                </div>
              ) : null}

              <div className="grid flex-1 grid-cols-1 gap-2.5 text-sm sm:grid-cols-2 lg:gap-x-8">
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Student&apos;s Name:</span>
                  <span className="font-semibold text-[#245C4F]">{studentName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Father&apos;s Name:</span>
                  <span className="font-semibold text-[#245C4F]">{fatherName}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Class / Section:</span>
                  <span className="font-semibold text-[#245C4F]">{className}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Roll / Admission #:</span>
                  <span className="font-semibold text-[#245C4F]">{rollNo}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Date of Birth / Age:</span>
                  <span className="font-semibold text-[#245C4F]">{age}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Academic Year / Term:</span>
                  <span className="font-semibold text-[#245C4F]">{academicYear} | {term}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Attendance ({term}):</span>
                  <span className="font-semibold text-[#245C4F]">TD: {td} | PD: {pd}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-[#E4D8BE] pb-1">
                  <span className="font-bold text-[#0F4C3A]">Status:</span>
                  <span className="font-semibold text-[#245C4F]">{item.status || "PUBLISHED"}</span>
                </div>
              </div>
            </div>

            {/* Sections in Paired 2-Column Tables */}
            {sections.map((section) => {
              const criteria = section.criteria || [];
              const mainHeading = mainHeadingForSection(section);
              const pairs = pairCriteria(criteria);
              const isSectionUrdu = section.key !== "mathematical_development";
              const thCriteria = isSectionUrdu ? "جائزے کے اہداف" : "Assessment Criteria";

              const isLanguageSec = ["listening", "speaking", "reading", "writing"].includes(section.key);

              return (
                <div key={section.key} className="rounded-[1.25rem] border border-[#E4D8BE] bg-white p-5 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between gap-4 mb-3.5 w-full">
                    <h3 className="text-sm sm:text-base font-black text-[#063F32] text-left">{mainHeading}</h3>
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#245C4F] text-right" dir="ltr">
                      {isLanguageSec ? (
                        <>
                          <bdi dir="ltr">({section.title_en || ""})</bdi>
                          {section.title_ur ? (
                            <>
                              <span className="text-[#8F8165]">/</span>
                              <bdi dir="rtl" className="font-['Noto_Naskh_Arabic',sans-serif] text-sm text-[#063F32] font-bold" style={{ wordSpacing: "0.05em" }}>{section.title_ur}</bdi>
                            </>
                          ) : null}
                        </>
                      ) : section.title_ur ? (
                        <bdi dir="rtl" className="font-['Noto_Naskh_Arabic',sans-serif] text-sm text-[#063F32] font-bold" style={{ wordSpacing: "0.05em" }}>{section.title_ur}</bdi>
                      ) : section.title_en && section.title_en !== mainHeading ? (
                        <bdi dir="ltr">({section.title_en})</bdi>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E4D8BE] overflow-hidden">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        {isSectionUrdu ? (
                          <tr className="bg-[#F1EADC] text-[#0F4C3A] font-bold">
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">FT</th>
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">MT</th>
                            <th className="border-b border-r border-[#E4D8BE] px-3 py-2 text-right font-['Noto_Naskh_Arabic',sans-serif] text-sm font-bold w-[36%]" style={{ direction: "rtl", wordSpacing: "0.05em" }}>{thCriteria}</th>
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">FT</th>
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">MT</th>
                            <th className="border-b border-[#E4D8BE] px-3 py-2 text-right font-['Noto_Naskh_Arabic',sans-serif] text-sm font-bold w-[36%]" style={{ direction: "rtl", wordSpacing: "0.05em" }}>{thCriteria}</th>
                          </tr>
                        ) : (
                          <tr className="bg-[#F1EADC] text-[#0F4C3A] font-bold">
                            <th className="border-b border-r border-[#E4D8BE] px-3 py-2 text-left w-[36%]">Assessment Criteria</th>
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">MT</th>
                            <th className="border-b border-r border-[#E4D8BE] px-2 py-2 text-center w-[7%]">FT</th>
                            <th className="border-b border-r border-[#E4D8BE] px-3 py-2 text-left w-[36%]">Assessment Criteria</th>
                            <th className="border-b border-[#E4D8BE] px-2 py-2 text-center w-[7%]">MT</th>
                            <th className="border-b border-[#E4D8BE] px-2 py-2 text-center w-[7%]">FT</th>
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {pairs.map(([c1, c2], pIdx) => {
                          const key1 = c1 ? responseKey(section, c1) : null;
                          const resp1 = key1 ? item.responses?.[key1] || {} : {};
                          const lbl1 = c1 ? (c1.label_ur || c1.label_en || "-") : "";
                          const isUrdu1 = c1?.language === "ur" || /[\u0600-\u06FF]/.test(lbl1);

                          const key2 = c2 ? responseKey(section, c2) : null;
                          const resp2 = key2 ? item.responses?.[key2] || {} : {};
                          const lbl2 = c2 ? (c2.label_ur || c2.label_en || "-") : "";
                          const isUrdu2 = c2?.language === "ur" || /[\u0600-\u06FF]/.test(lbl2);

                          if (isSectionUrdu) {
                            return (
                              <tr key={pIdx} className="hover:bg-[#FFFDF8]">
                                <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                  {resp1.ft || "-"}
                                </td>
                                <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                  {resp1.mt || "-"}
                                </td>
                                <td
                                  className={`border-b border-r border-[#E4D8BE] px-3 py-2 font-medium text-[#063F32] w-[36%] ${isUrdu1 ? "font-['Noto_Naskh_Arabic',sans-serif] text-sm text-right" : "text-left"
                                    }`}
                                  style={isUrdu1 ? { direction: "rtl", wordSpacing: "0.05em" } : undefined}
                                >
                                  {lbl1 || "-"}
                                </td>
                                <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                  {c2 ? (resp2.ft || "-") : ""}
                                </td>
                                <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                  {c2 ? (resp2.mt || "-") : ""}
                                </td>
                                <td
                                  className={`border-b border-[#E4D8BE] px-3 py-2 font-medium text-[#063F32] w-[36%] ${isUrdu2 ? "font-['Noto_Naskh_Arabic',sans-serif] text-sm text-right" : "text-left"
                                    }`}
                                  style={isUrdu2 ? { direction: "rtl", wordSpacing: "0.05em" } : undefined}
                                >
                                  {lbl2 || (c2 ? "-" : "")}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={pIdx} className="hover:bg-[#FFFDF8]">
                              <td className="border-b border-r border-[#E4D8BE] px-3 py-2 text-left font-medium text-[#063F32] w-[36%]">
                                {lbl1 || "-"}
                              </td>
                              <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                {resp1.mt || "-"}
                              </td>
                              <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                {resp1.ft || "-"}
                              </td>
                              <td className="border-b border-r border-[#E4D8BE] px-3 py-2 text-left font-medium text-[#063F32] w-[36%]">
                                {lbl2 || (c2 ? "-" : "")}
                              </td>
                              <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                {c2 ? (resp2.mt || "-") : ""}
                              </td>
                              <td className="border-b border-[#E4D8BE] bg-[#FFFCF5] px-2 py-2 text-center font-extrabold text-[#0F4C3A] w-[7%]">
                                {c2 ? (resp2.ft || "-") : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {/* Subject-Wise Performance Table */}
            {subjectPerf.length > 0 ? (
              <div className="rounded-[1.25rem] border border-[#E4D8BE] bg-white p-5 sm:p-6 shadow-xs">
                <div className="flex items-center justify-between gap-4 mb-3 w-full">
                  <h3 className="text-sm sm:text-base font-black text-[#063F32] text-left">Subject Wise Performance</h3>
                  <span className="text-xs sm:text-sm font-bold text-[#245C4F] text-right">({term})</span>
                </div>

                <div className="rounded-xl border border-[#E4D8BE] overflow-hidden">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F1EADC] text-[#0F4C3A] font-bold">
                        <th rowSpan={2} className="border-b border-r border-[#E4D8BE] px-3 py-2 text-center w-1/4">Subjects</th>
                        <th rowSpan={2} className="border-b border-r border-[#E4D8BE] px-3 py-2 text-center w-28">Performance</th>
                        <th colSpan={3} className="border-b border-[#E4D8BE] px-3 py-2 text-center">Remarks</th>
                      </tr>
                      <tr className="bg-[#F1EADC] text-[#0F4C3A] font-bold">
                        <th className="border-b border-r border-[#E4D8BE] px-3 py-1.5 text-center w-1/4">Teacher</th>
                        <th className="border-b border-r border-[#E4D8BE] px-3 py-1.5 text-center w-1/4">Principal</th>
                        <th className="border-b border-[#E4D8BE] px-3 py-1.5 text-center w-1/4">Parents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectPerf.map((row, index) => {
                        const displaySubject = row.subject === "دینی" ? "فہمِ دین" : (row.subject || "-");
                        const isUrdu = displaySubject === "فہمِ دین" || /[\u0600-\u06FF]/.test(displaySubject);
                        const perfVal = row.performance || row.midPerformance || row.finalPerformance || "-";

                        if (index === 0) {
                          return (
                            <tr key={index} className="hover:bg-[#FFFDF8]">
                              <td className={`border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-3 py-2 text-center font-bold text-[#063F32] ${isUrdu ? "font-['Noto_Naskh_Arabic',sans-serif] text-sm" : ""}`} style={isUrdu ? { direction: "rtl", wordSpacing: "0.16em" } : undefined}>
                                {displaySubject}
                              </td>
                              <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-3 py-2 text-center font-black text-[#0F4C3A]">
                                {perfVal}
                              </td>
                              <td rowSpan={subjectPerf.length} className="border-b border-r border-[#E4D8BE] p-3 align-top text-left text-xs text-[#245C4F] italic">
                                {remarks.teacher || item.teacher_remarks || "—"}
                              </td>
                              <td rowSpan={subjectPerf.length} className="border-b border-r border-[#E4D8BE] p-3 align-top text-left text-xs text-[#245C4F] italic">
                                {remarks.principal || "—"}
                              </td>
                              <td rowSpan={subjectPerf.length} className="border-b border-[#E4D8BE] p-3 align-top text-left text-xs text-[#245C4F] italic">
                                {remarks.parents || "—"}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={index} className="hover:bg-[#FFFDF8]">
                            <td className={`border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-3 py-2 text-center font-bold text-[#063F32] ${isUrdu ? "font-['Noto_Naskh_Arabic',sans-serif] text-sm" : ""}`} style={isUrdu ? { direction: "rtl", wordSpacing: "0.16em" } : undefined}>
                              {displaySubject}
                            </td>
                            <td className="border-b border-r border-[#E4D8BE] bg-[#FFFCF5] px-3 py-2 text-center font-black text-[#0F4C3A]">
                              {perfVal}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Signatures Row */}
                      <tr className="bg-[#F9F6EE] font-bold">
                        <td colSpan={2} className="border-r border-[#E4D8BE] px-3 py-3 text-center text-xs font-bold text-[#063F32]">
                          Name &amp; Signature
                        </td>
                        <td className="border-r border-[#E4D8BE] px-3 py-3 text-center text-xs font-semibold text-[#063F32]">
                          {signatures.teacher || "—"}
                        </td>
                        <td className="border-r border-[#E4D8BE] px-3 py-3 text-center text-xs font-semibold text-[#063F32]">
                          {signatures.principal || "—"}
                        </td>
                        <td className="px-3 py-3 text-center text-xs font-semibold text-[#063F32]">
                          {signatures.parents || "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* Rating Key Box — Placed at the end */}
            <div className="rounded-xl border border-[#C79A3B]/40 bg-[#FFF8E4] p-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0F4C3A]">Rating Key</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5 text-center text-xs">
                <div className="rounded-lg border border-[#C79A3B]/25 bg-white p-2">
                  <p className="font-black text-[#0F4C3A]">A+</p>
                  <p className="text-[10px] text-[#245C4F]">Excellent / Always</p>
                </div>
                <div className="rounded-lg border border-[#C79A3B]/25 bg-white p-2">
                  <p className="font-black text-[#0F4C3A]">A</p>
                  <p className="text-[10px] text-[#245C4F]">Good / Mostly</p>
                </div>
                <div className="rounded-lg border border-[#C79A3B]/25 bg-white p-2">
                  <p className="font-black text-[#0F4C3A]">B</p>
                  <p className="text-[10px] text-[#245C4F]">Average / Needs Improvement</p>
                </div>
                <div className="rounded-lg border border-[#C79A3B]/25 bg-white p-2">
                  <p className="font-black text-[#0F4C3A]">C</p>
                  <p className="text-[10px] text-[#245C4F]">Below Average / Special Attention</p>
                </div>
                <div className="rounded-lg border border-[#C79A3B]/25 bg-white p-2 col-span-2 sm:col-span-1">
                  <p className="font-black text-[#0F4C3A]">NA</p>
                  <p className="text-[10px] text-[#245C4F]">Not Observed</p>
                </div>
              </div>
            </div>

            {/* Assessment Document Footer (no border or background) */}
            <div className="mt-4 text-center text-xs font-semibold text-[#0F4C3A]">
              Basis of ECCE Assessment /EDI /Azeem Siddiqui/azeemedi@gmail.com/ 0333 218 54 71/Ash-Shajar-25th July 2026
            </div>
          </div>
        </div>

          {/* Modal Bottom Footer */}
          <div className="flex items-center justify-end border-t border-[#2D8A6A]/15 bg-[#FAF7F0] px-6 py-4">
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D5C48] px-6 py-2.5 text-xs sm:text-sm font-bold text-[#FAF7F0] shadow-sm transition hover:bg-[#063F32] active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {downloading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-[#F7E7A9]" />
              ) : (
                <Download className="h-4 w-4 text-[#F7E7A9]" />
              )}
              <span>{downloading ? "Downloading..." : "Download PDF"}</span>
            </button>
          </div>
        </div>
      </div>
    </ClientPortal>
  );
}
