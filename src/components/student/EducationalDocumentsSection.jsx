"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, BookOpen, List, Calendar } from "lucide-react";
import { loadStudentPortalJsonCached } from "@/lib/studentPortalClient";
import PaginationControls from "@/components/teacher/PaginationControls";

function getDocumentIcon(documentType) {
  const icons = {
    timetable: <Calendar size={18} />,
    curriculum: <BookOpen size={18} />,
    material_list: <List size={18} />,
    yearly_plan: <Calendar size={18} />,
    other: <FileText size={18} />,
  };
  return icons[documentType] || icons.other;
}

function getDocumentTypeLabel(documentType) {
  const labels = {
    timetable: "Timetable",
    curriculum: "Curriculum Plan",
    material_list: "Material List",
    yearly_plan: "Yearly Planning",
    parent_guide: "Parent Guide",
  };
  if (labels[documentType]) return labels[documentType];
  return String(documentType || "Document")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeClassLevel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isPdfPath(value) {
  return String(value || "").toLowerCase().includes(".pdf");
}

function isImagePath(value) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(String(value || ""));
}

function isVideoPath(value) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(String(value || ""));
}

function buildPreviewUrl(value) {
  return `/api/file-preview?path=${encodeURIComponent(String(value || ""))}`;
}

export default function EducationalDocumentsSection({ studentClassLevel }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil((documents?.length || 0) / pageSize));
  const visibleDocuments = useMemo(() => documents.slice((page - 1) * pageSize, page * pageSize), [documents, page]);
  const groupedDocs = useMemo(() => {
    return visibleDocuments.reduce((acc, doc) => {
      const type = doc.document_type || "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(doc);
      return acc;
    }, {});
  }, [visibleDocuments]);
  const previewUrl = useMemo(() => {
    if (!previewItem?.file_url) return "";
    return buildPreviewUrl(previewItem.file_url);
  }, [previewItem]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        setLoading(true);
        const data = await loadStudentPortalJsonCached(`/api/coordinator/educational-documents?classLevel=${encodeURIComponent(studentClassLevel)}`);

        const items = Array.isArray(data.items) ? data.items : [];

        // Filter documents for this class level or documents without class level (all classes)
        const studentLevel = normalizeClassLevel(studentClassLevel);
        const filtered = items.filter((item) => {
          const documentLevel = normalizeClassLevel(item.class_level);
          return !documentLevel || documentLevel === studentLevel;
        });

        setDocuments(filtered);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load documents.");
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }

    if (studentClassLevel) {
      loadDocuments();
    }
  }, [studentClassLevel]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
        <h2 className="text-lg font-semibold text-[#063F32]">Learning Resources</h2>
        <p className="mt-3 text-sm text-[#245C4F]">Loading resources...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6">
        <h2 className="text-lg font-semibold text-rose-700">Learning Resources</h2>
        <p className="mt-2 text-sm text-rose-600">{error}</p>
      </section>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] px-6 pb-4 pt-6 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
      <h2 className="text-lg font-semibold text-[#063F32]">📚 Learning Resources</h2>
      <p className="mt-1 text-sm text-[#245C4F]">Your class materials and guides</p>

      <div className="mt-5 space-y-3">
        {Object.entries(groupedDocs).map(([docType, docs]) => (
          <div key={docType}>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF6EF] text-[#0D5C48]">
                {getDocumentIcon(docType)}
              </div>
              <h3 className="text-sm font-semibold text-[#063F32]">{getDocumentTypeLabel(docType)}</h3>
            </div>

            <div className="ml-10 space-y-2 pb-3">
              {docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    if (isPdfPath(doc.file_url)) {
                      window.open(buildPreviewUrl(doc.file_url), "_blank", "noopener,noreferrer");
                      return;
                    }
                    if (isImagePath(doc.file_url)) {
                      setPreviewItem(doc);
                      return;
                    }
                    if (isVideoPath(doc.file_url)) {
                      window.open(buildPreviewUrl(doc.file_url), "_blank", "noopener,noreferrer");
                      return;
                    }
                    window.open(buildPreviewUrl(doc.file_url), "_blank", "noopener,noreferrer");
                  }}
                  className={`w-full rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] p-4 text-sm transition hover:bg-[#F1EADC] ${(isImagePath(doc.file_url) || isVideoPath(doc.file_url)) ? "text-left" : "flex items-center justify-between"}`}
                >
                  {isImagePath(doc.file_url) || isVideoPath(doc.file_url) ? (
                    <div className="flex items-center gap-4">
                      <span className="flex h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#2D8A6A]/15 bg-white shadow-sm">
                        {isImagePath(doc.file_url) ? (
                          <img src={buildPreviewUrl(doc.file_url)} alt={doc.title || "Document preview"} className="h-full w-full object-cover" />
                        ) : (
                          <video src={buildPreviewUrl(doc.file_url)} className="h-full w-full object-cover" muted playsInline />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-[#063F32]">{doc.title}</span>
                        <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Tap to preview</span>
                      </span>
                    </div>
                  ) : (
                    <span className="flex min-w-0 items-center gap-3">
                      <Download size={16} className="shrink-0 text-[#0D5C48]" />
                      <span className="min-w-0 truncate font-medium text-[#063F32]">{doc.title}</span>
                    </span>
                  )}
                  {!isImagePath(doc.file_url) && !isVideoPath(doc.file_url) ? (
                    <span className="mt-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Open</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {documents.length > pageSize ? (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalItems={documents.length}
          onPageChange={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
        />
      ) : null}

      {previewItem ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/60 px-4 py-8" onClick={() => setPreviewItem(null)}>
          <div
            className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F1EADC] px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{getDocumentTypeLabel(previewItem.document_type)}</p>
                <h3 className="mt-1 text-lg font-semibold text-[#063F32]">{previewItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>
            <div className="bg-[#FAF7F0] p-4">
              <img src={previewUrl} alt={previewItem.title || "Document preview"} className="max-h-[75vh] w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
