"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ClipboardCheck,
  FileText,
  ChevronRight,
  Sparkles,
  Download,
  RefreshCw,
  PieChart,
} from "lucide-react";
import { loadStudentPortalJsonCached } from "@/lib/studentPortalClient";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import PaginationControls from "@/components/teacher/PaginationControls";
import EcceAssessmentDetailModal from "./EcceAssessmentDetailModal";
import TermAssessmentDetailModal from "@/components/assessments/TermAssessmentDetailModal";
import { downloadAssessmentPdf } from "@/lib/ecceAssessmentPdf";
import { downloadTermAssessmentPdf, getAssessmentDisplayTerm } from "@/lib/termAssessmentPdf";
import { ECCE_SECTIONS } from "@/lib/ecceAssessmentTemplate";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export default function StudentAssessmentsSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [activeEcceModalItem, setActiveEcceModalItem] = useState(null);
  const [activeTermModalItem, setActiveTermModalItem] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const pageSize = 7;

  async function handleDirectDownload(item) {
    try {
      setDownloadingId(item.id);
      if (item.assessmentType === "term") {
        await downloadTermAssessmentPdf(item.raw);
      } else {
        await downloadAssessmentPdf(item.raw, ECCE_SECTIONS);
      }
    } catch (err) {
      console.error("Direct download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  }

  const loadAssessments = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true);
      setError("");

      // 1. Fetch ECCE Assessments
      let ecceItems = [];
      try {
        const ecceData = await loadStudentPortalJsonCached("/api/ecce-assessments", { force });
        const rawEcce = Array.isArray(ecceData?.items) ? ecceData.items : [];
        ecceItems = rawEcce
          .filter((item) => String(item.status || "").toUpperCase() === "PUBLISHED")
          .map((item) => ({
            id: item.id,
            assessmentType: "ecce",
            typeBadge: "ECCE Assessment",
            academic_year: item.academic_year || "Current Year",
            term: item.term || "ECCE Assessment",
            class_name: item.class_name || "—",
            remarks: item.teacher_remarks || item.responses?.__remarks?.teacher || "",
            published_at: item.published_at || item.updated_at,
            raw: item,
          }));
      } catch (err) {
        console.warn("Could not load ecce assessments:", err);
      }

      // 2. Fetch Term Assessments
      let termItems = [];
      try {
        const termRes = await fetch("/api/term-assessments/records", { cache: "no-store" });
        if (termRes.ok) {
          const termData = await termRes.json();
          const rawTerm = Array.isArray(termData?.assessments) ? termData.assessments : [];
          termItems = rawTerm
            .filter((item) => String(item.status || "").toUpperCase() === "PUBLISHED")
            .map((item) => ({
              id: item.id,
              assessmentType: "term",
              typeBadge: "Term Assessment",
              academic_year: item.academic_year || "Current Year",
              term: getAssessmentDisplayTerm(item),
              class_name: item.class_name || "—",
              remarks: item.teacher_remarks || "",
              published_at: item.updated_at || item.created_at,
              raw: item,
            }));
        }
      } catch (err) {
        console.warn("Could not load term assessments:", err);
      }

      // 3. Merge both and sort by most recent
      const merged = [...termItems, ...ecceItems].sort((a, b) => {
        const da = new Date(a.published_at || 0).getTime();
        const db = new Date(b.published_at || 0).getTime();
        return db - da;
      });

      setItems(merged);

      // Pre-warm browser image cache for ECCE items
      if (typeof window !== "undefined") {
        ecceItems.forEach(({ raw: item }) => {
          const sInfo = item.responses?.__studentInfo || {};
          const photo =
            item.profile_picture_url ||
            (sInfo.picturePath &&
            (/^https?:\/\//i.test(sInfo.picturePath) ||
              sInfo.picturePath.startsWith("data:") ||
              sInfo.picturePath.startsWith("blob:"))
              ? sInfo.picturePath
              : "") ||
            (sInfo.picturePath ? `/api/file-preview?path=${encodeURIComponent(sInfo.picturePath)}` : "") ||
            (item.profile_picture_path &&
            (/^https?:\/\//i.test(item.profile_picture_path) ||
              item.profile_picture_path.startsWith("data:") ||
              item.profile_picture_path.startsWith("blob:"))
              ? item.profile_picture_path
              : "") ||
            (item.profile_picture_path ? `/api/file-preview?path=${encodeURIComponent(item.profile_picture_path)}` : "");
          if (photo) {
            const preImg = new Image();
            preImg.src = photo;
          }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assessment reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAssessments();
  }, [loadAssessments]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">
          Assessment Reports
        </p>
        <h2 className="mt-1 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
          Learning progress &amp; evaluations
        </h2>
      </div>

      {loading ? (
        <div className="py-6">
          <OpenBookLoader title="Loading assessments" subtitle="Retrieving your latest reports..." />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && !error && (
        <div className="overflow-hidden rounded-[1.75rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(6,63,50,0.18)] backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm text-[#245C4F]">
              <thead className="border-b border-[#2D8A6A]/10 bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">Assessment Type</th>
                  <th className="px-5 py-4 whitespace-nowrap">Academic Year</th>
                  <th className="px-5 py-4 whitespace-nowrap">Term</th>
                  <th className="px-5 py-4 whitespace-nowrap">Class</th>
                  <th className="px-5 py-4 whitespace-nowrap">Observations / Remarks</th>
                  <th className="px-5 py-4 whitespace-nowrap">Published Date</th>
                  <th className="px-5 py-4 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D8A6A]/10">
                {visibleItems.length ? (
                  visibleItems.map((item) => {
                    const remarks = item.remarks || "";
                    const year = item.academic_year || "Current Year";
                    const term = item.term || "Term Assessment";
                    const publishedAt = formatDate(item.published_at);
                    const isTerm = item.assessmentType === "term";

                    return (
                      <tr
                        key={`${item.assessmentType}-${item.id}`}
                        className="bg-transparent transition hover:bg-[#FAF7F0]/80"
                      >
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isTerm ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#0D5C48]/30 bg-[#0D5C48]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#0D5C48]">
                              <PieChart className="h-3 w-3" />
                              Term Assessment
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#C9A227]/40 bg-[#FFF5D6] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#7A5E2B]">
                              <Sparkles className="h-3 w-3" />
                              ECCE Assessment
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-bold text-[#063F32] whitespace-nowrap">
                          {year}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#C9A227,#E4C766)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#063F32] shadow-xs">
                            {term}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-[#0D5C48] whitespace-nowrap">
                          {item.class_name || "—"}
                        </td>
                        <td className="px-5 py-4 max-w-[280px]">
                          {remarks ? (
                            <span className="line-clamp-2 italic text-[#245C4F]" title={remarks}>
                              &ldquo;{remarks}&rdquo;
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs font-medium text-[#245C4F] whitespace-nowrap">
                          {publishedAt || "—"}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (isTerm) {
                                  setActiveTermModalItem(item.raw);
                                } else {
                                  setActiveEcceModalItem(item.raw);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#0D5C48] px-4 py-1.5 text-xs font-bold text-[#FAF7F0] shadow-xs transition hover:bg-[#063F32] hover:shadow-md active:scale-95 cursor-pointer"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>View Report</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDirectDownload(item)}
                              disabled={downloadingId === item.id}
                              className="inline-flex items-center gap-1.5 rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#0F4C3A] shadow-xs transition hover:border-[#C79A3B]/60 hover:bg-[#FAF7F0] active:scale-95 cursor-pointer disabled:opacity-60"
                              title="Download Assessment Report as PDF"
                            >
                              {downloadingId === item.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0D5C48]" />
                              ) : (
                                <Download className="h-3.5 w-3.5 text-[#0D5C48]" />
                              )}
                              <span>{isTerm ? "Download Report" : "PDF"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D8A6A]/10 text-[#0D5C48]">
                        <ClipboardCheck className="h-6 w-6" />
                      </div>
                      <p className="mt-3 font-semibold text-[#063F32]">No assessment reports published yet</p>
                      <p className="mt-1 text-xs text-[#245C4F]">
                        When your teacher or coordinator publishes your evaluation report, it will appear here.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {items.length > pageSize ? (
            <PaginationControls
              page={safePage}
              pageSize={pageSize}
              totalItems={items.length}
              tone="light"
              onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
            />
          ) : null}
        </div>
      )}

      {/* Interactive Popup Modal for ECCE Assessment Report */}
      {activeEcceModalItem ? (
        <EcceAssessmentDetailModal
          item={activeEcceModalItem}
          onClose={() => setActiveEcceModalItem(null)}
        />
      ) : null}

      {/* Interactive Popup Modal for Term Assessment Report with Pie Charts */}
      {activeTermModalItem ? (
        <TermAssessmentDetailModal
          item={activeTermModalItem}
          onClose={() => setActiveTermModalItem(null)}
        />
      ) : null}
    </div>
  );
}
