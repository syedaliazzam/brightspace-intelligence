"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, Edit2, Search } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { STORAGE_SAFE_UPLOAD_MAX_BYTES, formatUploadLimit } from "@/lib/uploadLimits";

const PAGE_SIZE = 7;
const DOCUMENT_TYPES = [
  { id: "timetable", label: "Timetable" },
  { id: "curriculum", label: "Curriculum Plan" },
  { id: "material_list", label: "Material List" },
  { id: "parent_guide", label: "Parent Guide" },
  { id: "yearly_plan", label: "Yearly Planning" },
  { id: "other", label: "Other" },
];

const CLASS_LEVELS = ["Play Group", "Prep I", "Prep II"];

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PK", { dateStyle: "medium" });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
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

function filterAllowedFiles(files) {
  return Array.from(files || []).filter((file) => Number(file?.size || 0) <= STORAGE_SAFE_UPLOAD_MAX_BYTES);
}

export default function EducationalDocumentsPage({
  allowManage = true,
  showActionsColumn = true,
  portalLabel = "Coordinator portal",
  title = "Educational Documents",
  description = "Manage timetables, curriculum plans, material lists, and other educational resources for all classes.",
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeOpen, setTypeOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [form, setForm] = useState({ title: "", documentType: "", customDocumentType: "", classLevel: "" });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/coordinator/educational-documents", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to load educational documents.");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load educational documents.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title || !form.documentType) {
      setError("All fields are required.");
      return;
    }
    const resolvedDocumentType = form.documentType === "other" ? normalizeText(form.customDocumentType) : form.documentType;
    if (!resolvedDocumentType) {
      setError("Custom document type is required.");
      return;
    }
    if (!editingItem && !selectedFiles.length) {
      setError("Document file is required.");
      return;
    }
    const oversizedFile = selectedFiles.find((file) => Number(file?.size || 0) > STORAGE_SAFE_UPLOAD_MAX_BYTES);
    if (oversizedFile) {
      setError(`One selected file is too large. Please upload files smaller than ${formatUploadLimit()}.`);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const basePayload = {
        title: form.title,
        documentType: resolvedDocumentType,
        classLevel: form.classLevel || "",
      };

      async function submitJson(endpoint, method, payload) {
        const response = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Unable to save document.");
        return data;
      }

      async function submitForm(endpoint, method, payload) {
        const response = await fetch(endpoint, {
          method,
          body: payload,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || "Unable to save document.");
        return data;
      }

      if (!editingItem) {
        const payload = new FormData();
        payload.append("title", basePayload.title);
        payload.append("documentType", basePayload.documentType);
        payload.append("classLevel", basePayload.classLevel);
        selectedFiles.forEach((file) => payload.append("files", file));
        await submitForm("/api/coordinator/educational-documents", "POST", payload);
      } else if (!selectedFiles.length) {
        await submitJson("/api/coordinator/educational-documents", "PATCH", {
          id: editingItem.id,
          ...basePayload,
        });
      } else {
        const [firstFile, ...extraFiles] = selectedFiles;

        const updatePayload = new FormData();
        updatePayload.append("id", editingItem.id);
        updatePayload.append("title", basePayload.title);
        updatePayload.append("documentType", basePayload.documentType);
        updatePayload.append("classLevel", basePayload.classLevel);
        updatePayload.append("files", firstFile);
        await submitForm("/api/coordinator/educational-documents", "PATCH", updatePayload);

        for (const extraFile of extraFiles) {
          const extraPayload = new FormData();
          extraPayload.append("title", basePayload.title);
          extraPayload.append("documentType", basePayload.documentType);
          extraPayload.append("classLevel", basePayload.classLevel);
          extraPayload.append("files", extraFile);
          await submitForm("/api/coordinator/educational-documents", "POST", extraPayload);
        }
      }

      setShowAddModal(false);
      setForm({ title: "", documentType: "", customDocumentType: "", classLevel: "" });
      setSelectedFiles([]);
      setEditingItem(null);
      setMessage("Document saved successfully.");
      window.setTimeout(() => setMessage(""), 3000);
      await loadDocuments();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save document.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/coordinator/educational-documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTargetId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to delete document.");

      setShowDeleteModal(false);
      setDeleteTargetId(null);
      setMessage(data?.message || "Document deleted successfully.");
      window.setTimeout(() => setMessage(""), 3000);
      await loadDocuments();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete document.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, classFilter, searchTerm]);

  const filteredItems = useMemo(() => {
    const query = normalizeText(searchTerm);
    return items.filter((item) => {
      if (typeFilter !== "all" && String(item.document_type || "") !== typeFilter) return false;
      if (classFilter !== "all" && String(item.class_level || "") !== classFilter) return false;
      if (!query) return true;
      return normalizeText(item.title).includes(query);
    });
  }, [items, typeFilter, classFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const getTypeLabel = (typeId) => {
    const type = DOCUMENT_TYPES.find((t) => t.id === typeId);
    return type?.label || typeId;
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
              <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
                {portalLabel}
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">{title}</h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
            </div>
            {allowManage ? (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setForm({ title: "", documentType: "", customDocumentType: "", classLevel: "" });
                  setSelectedFiles([]);
                  setShowAddModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-[#FFF5D6] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] lg:self-auto"
              >
                <Plus size={18} />
                Add Document
              </button>
            ) : null}
          </div>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#EAF6EF] p-4 text-sm text-[#0D5C48]">{message}</div> : null}

        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
          <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
            <h2 className="text-xl font-semibold text-[#063F32]">Documents</h2>
          </div>

          <div className="grid gap-4 border-b border-[#2D8A6A]/10 px-6 py-5 lg:grid-cols-[1fr_1fr_minmax(0,1fr)]">
            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Document Type</p>
              <select
                value={typeFilter}
                onFocus={() => setTypeOpen(true)}
                onBlur={() => setTypeOpen(false)}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All types</option>
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${typeOpen ? "rotate-180" : ""}`} />
            </div>

            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Class Level</p>
              <select
                value={classFilter}
                onFocus={() => setClassOpen(true)}
                onBlur={() => setClassOpen(false)}
                onChange={(event) => setClassFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All classes</option>
                {CLASS_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${classOpen ? "rotate-180" : ""}`} />
            </div>

            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</p>
              <Search className="pointer-events-none absolute left-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search documents"
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">#</th>
                  <th className="whitespace-nowrap px-6 py-4">Title</th>
                  <th className="whitespace-nowrap px-6 py-4">Type</th>
                  <th className="whitespace-nowrap px-6 py-4">Class Level</th>
                  <th className="whitespace-nowrap px-6 py-4">View Document</th>
                  <th className="whitespace-nowrap px-6 py-4">Created</th>
                  {showActionsColumn ? <th className="whitespace-nowrap px-6 py-4 text-right">Actions</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {visibleItems.length ? (
                  visibleItems.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-semibold text-[#0D5C48]">{String((safePage - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}</td>
                      <td className="px-6 py-4 font-semibold text-[#063F32]">{item.title || "-"}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{getTypeLabel(item.document_type) || "-"}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{item.class_level || "All Classes"}</td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (isImagePath(item.file_url)) {
                              window.open(buildPreviewUrl(item.file_url), "_blank", "noopener,noreferrer");
                              return;
                            }
                            window.open(buildPreviewUrl(item.file_url), "_blank", "noopener,noreferrer");
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                        >
                          View Document
                        </button>
                      </td>
                      <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.created_at)}</td>
                      {showActionsColumn ? (
                        <td className="px-6 py-4 text-right">
                          {allowManage ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setForm({
                                    title: item.title || "",
                                    documentType: item.document_type || "",
                                    customDocumentType: "",
                                    classLevel: item.class_level || "",
                                  });
                                  setSelectedFiles([]);
                                  setShowAddModal(true);
                                }}
                                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] p-2 text-[#063F32] transition hover:bg-[#F1EADC]"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteTargetId(item.id);
                                  setShowDeleteModal(true);
                                }}
                                className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#245C4F]" colSpan={showActionsColumn ? 7 : 6}>
                      {loading ? "Loading documents..." : "No educational documents found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredItems.length > PAGE_SIZE ? (
            <PaginationControls page={safePage} pageSize={PAGE_SIZE} totalItems={filteredItems.length} onPageChange={setPage} />
          ) : null}
        </section>
      </div>

      {allowManage && showAddModal ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/45 px-4 py-8">
            <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-semibold text-[#063F32]">{editingItem ? "Edit Document" : "Add Educational Document"}</h3>
                <p className="mt-1 text-sm text-[#245C4F]">Manage timetables, curricula, and learning materials</p>
              </div>

              {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">Document Title *</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                    placeholder="e.g., Play Group Timetable"
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">Document Type *</span>
                  <select
                    value={form.documentType}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        documentType: e.target.value,
                        customDocumentType: e.target.value === "other" ? c.customDocumentType : "",
                      }))
                    }
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                    required
                  >
                    <option value="">Select a type</option>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>

                {form.documentType === "other" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Custom Type *</span>
                    <input
                      type="text"
                      value={form.customDocumentType}
                      onChange={(e) => setForm((c) => ({ ...c, customDocumentType: e.target.value }))}
                      placeholder="e.g., Parent Guide"
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">Class Level</span>
                  <select
                    value={form.classLevel}
                    onChange={(e) => setForm((c) => ({ ...c, classLevel: e.target.value }))}
                    className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                  >
                    <option value="">All Classes</option>
                    {CLASS_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">File *</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg,.mp4,.webm,.ogg,.mov,.m4v"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      const allowedFiles = filterAllowedFiles(files);
                      if (allowedFiles.length !== files.length) {
                        setError(`One or more selected files are too large. Please upload files smaller than ${formatUploadLimit()}.`);
                      }
                      setSelectedFiles(allowedFiles);
                    }}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                    required={!editingItem}
                  />
                  <p className="mt-2 text-xs text-[#245C4F]">Maximum file size: {formatUploadLimit()} per file.</p>
                  {selectedFiles.length ? (
                    <div className="mt-2 space-y-1 text-xs text-[#245C4F]">
                      <p>{selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected</p>
                      <ul className="max-h-28 space-y-1 overflow-auto rounded-xl bg-white/70 p-2">
                        {selectedFiles.map((file) => (
                          <li key={`${file.name}-${file.size}`} className="truncate">
                            {file.name}
                            {isVideoPath(file.name) ? " (video)" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {editingItem ? <p className="mt-2 text-xs text-[#245C4F]">Leave blank to keep the current file.</p> : null}
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      setForm({ title: "", documentType: "", customDocumentType: "", classLevel: "" });
                      setSelectedFiles([]);
                      setError("");
                    }}
                    className="flex-1 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-2xl bg-[#0D5C48] px-4 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : editingItem ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ClientPortal>
      ) : null}

      {allowManage && showDeleteModal ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/45 px-4 py-8">
            <div className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <h3 className="text-lg font-semibold text-[#063F32]">Remove Document</h3>
              <p className="mt-3 text-sm text-[#245C4F]">Are you sure you want to remove this educational document from all portals? This action cannot be undone.</p>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteTargetId(null);
                  }}
                  className="flex-1 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex-1 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {submitting ? "Removing..." : "Remove"}
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}
    </div>
  );
}
