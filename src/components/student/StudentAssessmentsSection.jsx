"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, FileText, CheckCircle2, ChevronRight, Sparkles, Download, RefreshCw } from "lucide-react";
import { loadStudentPortalJsonCached } from "@/lib/studentPortalClient";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";
import PaginationControls from "@/components/teacher/PaginationControls";
import EcceAssessmentDetailModal from "./EcceAssessmentDetailModal";
import { downloadAssessmentPdf } from "@/lib/ecceAssessmentPdf";
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
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const pageSize = 7;

  async function handleDirectDownload(item) {
    try {
      setDownloadingId(item.id);
      await downloadAssessmentPdf(item, ECCE_SECTIONS);
    } catch (err) {
      console.error("Direct download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  }

  async function loadAssessments({ force = false } = {}) {
    try {
      setLoading(true);
      setError("");
      const data = await loadStudentPortalJsonCached("/api/ecce-assessments", { force });
      const assessmentItems = Array.isArray(data?.items) ? data.items : [];
      // Published assessments only
      const published = assessmentItems.filter(
        (item) => String(item.status || "").toUpperCase() === "PUBLISHED"
      );
      setItems(published);

      // Pre-warm browser image cache so popup modals open with instant images
      if (typeof window !== "undefined") {
        published.forEach((item) => {
          const sInfo = item.responses?.__studentInfo || {};
          const photo = item.profile_picture_url ||
            (sInfo.picturePath && (/^https?:\/\//i.test(sInfo.picturePath) || sInfo.picturePath.startsWith("data:") || sInfo.picturePath.startsWith("blob:")) ? sInfo.picturePath : "") ||
            (sInfo.picturePath ? `/api/file-preview?path=${encodeURIComponent(sInfo.picturePath)}` : "") ||
            (item.profile_picture_path && (/^https?:\/\//i.test(item.profile_picture_path) || item.profile_picture_path.startsWith("data:") || item.profile_picture_path.startsWith("blob:")) ? item.profile_picture_path : "") ||
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
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAssessments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0D5C48]">Assessment Reports</p>
        <h2 className="mt-1 font-body text-2xl font-semibold tracking-tight text-[#063F32]">
          ECCE learning progress & evaluations
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
                  <th className="px-5 py-4 whitespace-nowrap">Academic Year</th>
                  <th className="px-5 py-4 whitespace-nowrap">Term</th>
                  <th className="px-5 py-4 whitespace-nowrap">Class</th>
                  <th className="px-5 py-4 whitespace-nowrap">Teacher</th>
                  <th className="px-5 py-4 whitespace-nowrap">Teacher Remarks</th>
                  <th className="px-5 py-4 whitespace-nowrap">Published Date</th>
                  <th className="px-5 py-4 whitespace-nowrap">Status</th>
                  <th className="px-5 py-4 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D8A6A]/10">
                {visibleItems.length ? (
                  visibleItems.map((item) => {
                    const remarks = item.teacher_remarks || item.responses?.__remarks?.teacher || "";
                    const year = item.academic_year || "Current Year";
                    const term = item.term || "Term Assessment";
                    const publishedAt = formatDate(item.published_at || item.updated_at);

                    return (
                      <tr
                        key={item.id}
                        className="bg-transparent transition hover:bg-[#FAF7F0]/80"
                      >
                        <td className="px-5 py-4 font-bold text-[#063F32] whitespace-nowrap">
                          {year}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(135deg,#C9A227,#E4C766)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#063F32] shadow-sm">
                            <Sparkles className="h-3 w-3" />
                            {term}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-[#0D5C48] whitespace-nowrap">
                          {item.class_name || "—"}
                        </td>
                        <td className="px-5 py-4 text-[#063F32] whitespace-nowrap">
                          {item.teacher_name || "—"}
                        </td>
                        <td className="px-5 py-4 max-w-[240px]">
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
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100/90 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Published
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveModalItem(item)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#0D5C48] px-3.5 py-1.5 text-xs font-bold text-[#FAF7F0] shadow-sm transition hover:bg-[#063F32] hover:shadow-md active:scale-95 cursor-pointer"
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
                              title="Download Assessment PDF directly"
                            >
                              {downloadingId === item.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0D5C48]" />
                              ) : (
                                <Download className="h-3.5 w-3.5 text-[#0D5C48]" />
                              )}
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2D8A6A]/10 text-[#0D5C48]">
                        <ClipboardCheck className="h-6 w-6" />
                      </div>
                      <p className="mt-3 font-semibold text-[#063F32]">No assessment reports published yet</p>
                      <p className="mt-1 text-xs text-[#245C4F]">
                        When your teacher conducts and publishes your official ECCE assessment, it will appear here.
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

      {/* Interactive Popup Modal for Assessment Report Details */}
      {activeModalItem ? (
        <EcceAssessmentDetailModal
          item={activeModalItem}
          onClose={() => setActiveModalItem(null)}
        />
      ) : null}
    </div>
  );
}
