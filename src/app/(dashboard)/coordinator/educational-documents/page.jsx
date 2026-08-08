"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, Edit2, Search } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";

const PAGE_SIZE = 7;
const DOCUMENT_TYPES = [
  { id: "timetable", label: "Timetable" },
  { id: "curriculum", label: "Curriculum Plan" },
  { id: "material_list", label: "Material List" },
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

export default function EducationalDocumentsPage() {
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
  const [form, setForm] = useState({ title: "", documentType: "", classLevel: "" });
  const [selectedFile, setSelectedFile] = useState(null);
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
    if (!editingItem && !selectedFile) {
      setError("Document file is required.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const endpoint = "/api/coordinator/educational-documents";
      const method = editingItem ? "PATCH" : "POST";
      const payload = new FormData();
      payload.append("title", form.title);
      payload.append("documentType", form.documentType);
      payload.append("classLevel", form.classLevel || "");
      if (editingItem) {
        payload.append("id", editingItem.id);
      }
      if (selectedFile) {
        payload.append("file", selectedFile);
      }

      const response = await fetch(endpoint, {
        method,
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to save document.");

      setShowAddModal(false);
      setForm({ title: "", documentType: "", classLevel: "" });
      setSelectedFile(null);
      setEditingItem(null);
      setMessage(data?.message || "Document saved successfully.");
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
                Coordinator portal
              </p>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Educational Documents</h1>
              <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
                Manage timetables, curriculum plans, material lists, and other educational resources for all classes.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingItem(null);
                setForm({ title: "", documentType: "", classLevel: "" });
                setSelectedFile(null);
                setShowAddModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-[#FFF5D6] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] lg:self-auto"
            >
              <Plus size={18} />
              Add Document
            </button>
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
                  <th className="whitespace-nowrap px-6 py-4">Created</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Actions</th>
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
                      <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setForm({
                                title: item.title || "",
                                documentType: item.document_type || "",
                                classLevel: item.class_level || "",
                              });
                              setSelectedFile(null);
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#245C4F]" colSpan={6}>
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

      {showAddModal ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[9999] isolate min-h-full overflow-visible bg-[#063F32]/45 px-4 py-10">
            <div className="mx-auto max-w-2xl rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-8">
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
                    onChange={(e) => setForm((c) => ({ ...c, documentType: e.target.value }))}
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
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-[#0D5C48] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#FAF7F0] focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                    required={!editingItem}
                  />
                  {editingItem ? <p className="mt-2 text-xs text-[#245C4F]">Leave blank to keep the current file.</p> : null}
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      setForm({ title: "", documentType: "", classLevel: "" });
                      setSelectedFile(null);
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

      {showDeleteModal ? (
        <ClientPortal targetId="coordinator-page-portal-root">
          <div className="absolute inset-x-0 top-0 z-[9999] isolate min-h-full overflow-visible bg-[#063F32]/45 px-4 py-10">
            <div className="mx-auto max-w-sm rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
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
