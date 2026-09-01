"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, Edit2, Search, FileImage, FileVideo, FileText, File } from "lucide-react";
import ClientPortal from "@/components/shared/ClientPortal";
import PaginationControls from "@/components/teacher/PaginationControls";
import { STORAGE_SAFE_UPLOAD_MAX_BYTES, formatUploadLimit } from "@/lib/uploadLimits";

const PAGE_SIZE = 7;
const LIBRARY_CACHE_TTL_MS = 60 * 1000;
const pendingLibraryRequests = new Map();

function readLibraryCache(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.cachedAt || Date.now() - parsed.cachedAt >= LIBRARY_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLibraryCache(key, data) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {
    // Keep library usable if browser storage is unavailable.
  }
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PK", { dateStyle: "medium" });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildPreviewUrl(value) {
  return `/api/file-preview?path=${encodeURIComponent(String(value || ""))}`;
}

function filterAllowedFiles(files) {
  return Array.from(files || []).filter((file) => Number(file?.size || 0) <= STORAGE_SAFE_UPLOAD_MAX_BYTES);
}

function normalizeIdList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  const singleValue = String(value || "").trim();
  return singleValue ? [singleValue] : fallback;
}

function formatSelectedTitles(options, selectedIds) {
  const selectedSet = new Set(selectedIds);
  const labels = options.filter((option) => selectedSet.has(option.id)).map((option) => option.title);
  if (!labels.length) return "None selected";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
}

function uniqueById(options = []) {
  return [...new Map(options.map((option) => [option.id, option])).values()];
}

function MultiSelectChecklist({ label, options, selectedIds, onChange, required = false, disabled = false }) {
  const selectedSet = new Set(selectedIds);

  function toggle(id) {
    if (disabled) return;
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
      return;
    }
    onChange([...selectedIds, id]);
  }

  return (
    <div className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="block text-sm font-medium text-[#245C4F]">
          {label} {required ? "*" : ""}
        </span>
        <span className="rounded-full bg-[#EAF6EF] px-3 py-1 text-[11px] font-semibold text-[#0D5C48]">
          {selectedIds.length} selected
        </span>
      </div>
      <div className={`rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] p-3 transition ${disabled ? "opacity-60" : "focus-within:border-[#2D8A6A] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#FFF5D6]"}`}>
        <p className="mb-3 truncate text-xs font-semibold text-[#063F32]">
          {formatSelectedTitles(options, selectedIds)}
        </p>
        <div className="grid max-h-44 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {options.length ? options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              disabled={disabled}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
                selectedSet.has(option.id)
                  ? "border-[#0D5C48] bg-[#0D5C48] text-[#FAF7F0]"
                  : "border-[#2D8A6A]/15 bg-white text-[#245C4F] hover:border-[#2D8A6A]/30 hover:bg-[#EAF6EF]"
              }`}
            >
              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedSet.has(option.id) ? "border-[#FAF7F0] bg-[#FAF7F0]" : "border-[#2D8A6A]/30 bg-[#FAF7F0]"}`}>
                {selectedSet.has(option.id) ? <span className="h-2 w-2 rounded-sm bg-[#0D5C48]" /> : null}
              </span>
              <span className="min-w-0 truncate">{option.title}</span>
            </button>
          )) : (
            <p className="rounded-xl border border-dashed border-[#2D8A6A]/20 bg-white px-3 py-3 text-xs text-[#7A938B]">
              No options available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

async function uploadLibraryAsset(file) {
  const response = await fetch("/api/coordinator/library/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file?.name || "document",
      contentType: file?.type || "application/octet-stream",
    }),
  });
  const responseData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(responseData?.message || responseData?.error || "Unable to prepare document upload.");
  }

  const uploadResponse = await fetch(responseData.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file?.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    throw new Error(text || "Unable to upload document file.");
  }

  let fileType = 'other';
  const fileUrlLower = normalizeText(file.name).toLowerCase();
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(fileUrlLower)) fileType = 'image';
  else if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(fileUrlLower)) fileType = 'video';
  else if (fileUrlLower.includes('.pdf')) fileType = 'pdf';

  return {
    url: responseData.path,
    originalName: file.name,
    fileType,
  };
}

export default function LibraryPageShell({
  allowManage = true,
  showActionsColumn = true,
  portalLabel = "Coordinator portal",
  title = "Library",
  description = "Manage educational resources, videos, and documents.",
  cacheNamespace = "",
  showTableFilePreviews = true,
  portalTargetId = "coordinator-page-portal-root",
}) {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);

  const [classFilter, setClassFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  const [classOpen, setClassOpen] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const [form, setForm] = useState({ title: "", description: "", courseIds: [], subjectIds: [], docDate: new Date().toISOString().split('T')[0] });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]); // Array of existing file objects to keep

  const [submitting, setSubmitting] = useState(false);

  function buildPortalQuery() {
    const params = new URLSearchParams();
    if (portalLabel) params.set("portalType", portalLabel);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const portalQuery = buildPortalQuery();
      const cacheKey = cacheNamespace ? `${cacheNamespace}:library:${portalQuery}` : "";
      const cached = readLibraryCache(cacheKey);

      if (cached) {
        setItems(Array.isArray(cached.items) ? cached.items : []);
        setClasses(Array.isArray(cached.classes) ? cached.classes : []);
        setSubjects(Array.isArray(cached.subjects) ? cached.subjects : []);
        setLoading(false);
        return;
      }

      let request = cacheKey ? pendingLibraryRequests.get(cacheKey) : null;
      if (!request) {
        request = Promise.all([
          fetch(`/api/coordinator/library${portalQuery}`, { cache: "no-store" }),
          fetch(`/api/coordinator/library/filters${portalQuery}`, { cache: "no-store" })
        ])
          .then(async ([docRes, filterRes]) => {
            const docData = await docRes.json().catch(() => ({}));
            const filterData = await filterRes.json().catch(() => ({}));
            if (!docRes.ok) throw new Error(docData?.message || "Unable to load library documents.");
            if (!filterRes.ok) throw new Error(filterData?.message || "Unable to load filters.");
            return { docData, filterData };
          })
          .finally(() => {
            if (cacheKey) pendingLibraryRequests.delete(cacheKey);
          });
        if (cacheKey) pendingLibraryRequests.set(cacheKey, request);
      }

      const { docData, filterData } = await request;
      const nextData = {
        items: Array.isArray(docData.items) ? docData.items : [],
        classes: Array.isArray(filterData.classes) ? filterData.classes : [],
        subjects: Array.isArray(filterData.subjects) ? filterData.subjects : [],
      };
      writeLibraryCache(cacheKey, nextData);
      setItems(nextData.items);
      setClasses(nextData.classes);
      setSubjects(nextData.subjects);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load library data.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.title || !form.courseIds.length || !form.subjectIds.length || !form.docDate) {
      setError("All required fields must be filled.");
      return;
    }

    if (!editingItem && !selectedFiles.length) {
      setError("At least one document file is required.");
      return;
    }

    if (editingItem && !selectedFiles.length && !existingFiles.length) {
      setError("At least one document file is required.");
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
        description: form.description,
        courseId: form.courseIds[0] || "",
        subjectId: form.subjectIds[0] || "",
        courseIds: form.courseIds,
        subjectIds: form.subjectIds,
        docDate: form.docDate,
      };

      const uploadedFiles = [];
      for (const file of selectedFiles) {
        uploadedFiles.push(await uploadLibraryAsset(file));
      }

      const method = editingItem ? "PATCH" : "POST";
      const portalQuery = buildPortalQuery();
      const payload = editingItem ? {
        ...basePayload,
        id: editingItem.id,
        files: uploadedFiles,
        existingFileIds: existingFiles.map(f => f.id)
      } : {
        ...basePayload,
        files: uploadedFiles
      };

      const response = await fetch(`/api/coordinator/library${portalQuery}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to save document.");

      setShowAddModal(false);
      resetForm();
      setMessage("Document saved successfully.");
      window.setTimeout(() => setMessage(""), 3000);
      await loadData();
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
      const portalQuery = buildPortalQuery();
      const response = await fetch(`/api/coordinator/library${portalQuery}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTargetId }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Unable to archive document.");

      setShowDeleteModal(false);
      setDeleteTargetId(null);
      setMessage(data?.message || "Document archived successfully.");
      window.setTimeout(() => setMessage(""), 3000);
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to archive document.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [portalLabel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      if (classFilter !== 'all' && subjectFilter !== 'all') {
        const validSubject = subjects.find(s => s.course_id === classFilter && s.id === subjectFilter);
        if (!validSubject) setSubjectFilter('all');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [classFilter, subjectFilter, dateFilter, subjects]);

  const filteredSubjects = useMemo(() => {
    if (classFilter === 'all') return uniqueById(subjects);
    return uniqueById(subjects.filter(s => s.course_id === classFilter));
  }, [subjects, classFilter]);

  const formSubjectOptions = useMemo(() => {
    if (!form.courseIds.length) return uniqueById(subjects);
    return uniqueById(subjects.filter((subject) => form.courseIds.includes(subject.course_id)));
  }, [subjects, form.courseIds]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (item.status === 'archived') return false;
      const itemCourseIds = normalizeIdList(item.course_ids, item.course_id ? [item.course_id] : []);
      const itemSubjectIds = normalizeIdList(item.subject_ids, item.subject_id ? [item.subject_id] : []);
      if (classFilter !== "all" && !itemCourseIds.includes(classFilter)) return false;
      if (subjectFilter !== "all" && !itemSubjectIds.includes(subjectFilter)) return false;
      if (dateFilter && item.doc_date) {
        const itemDate = new Date(item.doc_date).toISOString().split('T')[0];
        if (itemDate !== dateFilter) return false;
      }
      return true;
    });
  }, [items, classFilter, subjectFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, safePage]);

  const selectedClassTitle = useMemo(() => {
    if (classFilter === "all") return "";
    return classes.find((cls) => cls.id === classFilter)?.title || "";
  }, [classes, classFilter]);

  function getClassDisplay(item) {
    if (selectedClassTitle) return selectedClassTitle;

    const itemCourseIds = normalizeIdList(item.course_ids, item.course_id ? [item.course_id] : []);
    const classNames = classes
      .filter((cls) => itemCourseIds.includes(cls.id))
      .map((cls) => cls.title)
      .filter(Boolean);

    return classNames.length ? classNames.join(", ") : item.course_titles || item.class_level || item.course_title || "-";
  }

  function getSubjectDisplay(item) {
    const itemSubjectIds = normalizeIdList(item.subject_ids, item.subject_id ? [item.subject_id] : []);
    const visibleSubjects = subjects.filter((subject) => {
      if (!itemSubjectIds.includes(subject.id)) return false;
      if (classFilter !== "all" && subject.course_id !== classFilter) return false;
      return true;
    });

    const names = uniqueById(visibleSubjects).map((subject) => subject.title).filter(Boolean);
    return names.length ? names.join(", ") : item.subject_names || item.subject_name || "-";
  }

  function resetForm() {
    setForm({ title: "", description: "", courseIds: [], subjectIds: [], docDate: new Date().toISOString().split('T')[0] });
    setSelectedFiles([]);
    setExistingFiles([]);
    setEditingItem(null);
    setError("");
  }

  function getFileIcon(fileType) {
    if (fileType === 'image') return <FileImage className="text-blue-500" size={16} />;
    if (fileType === 'video') return <FileVideo className="text-purple-500" size={16} />;
    if (fileType === 'pdf') return <FileText className="text-rose-500" size={16} />;
    return <File className="text-gray-500" size={16} />;
  }

  return (
    <div id={portalTargetId} className="relative min-h-screen bg-[#FAF7F0]">
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
                  resetForm();
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
            <h2 className="text-xl font-semibold text-[#063F32]">Library Records</h2>
          </div>

          <div className="grid gap-4 border-b border-[#2D8A6A]/10 px-6 py-5 lg:grid-cols-[1fr_1fr_1fr]">
            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Class</p>
              <select
                value={classFilter}
                onFocus={() => setClassOpen(true)}
                onBlur={() => setClassOpen(false)}
                onChange={(event) => setClassFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.title}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${classOpen ? "rotate-180" : ""}`} />
            </div>

            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Subject</p>
              <select
                value={subjectFilter}
                onFocus={() => setSubjectOpen(true)}
                onBlur={() => setSubjectOpen(false)}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All subjects</option>
                {filteredSubjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.title}
                  </option>
                ))}
              </select>
              <ChevronDown className={`pointer-events-none absolute right-4 top-[calc(50%+14px)] h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform ${subjectOpen ? "rotate-180" : ""}`} />
            </div>

            <div className="relative">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Date</p>
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">Title</th>
                  <th className="whitespace-nowrap px-6 py-4">Class</th>
                  <th className="whitespace-nowrap px-6 py-4">Subject</th>
                  <th className="whitespace-nowrap px-6 py-4">Date</th>
                  <th className="whitespace-nowrap px-6 py-4">Documents</th>
                  <th className="whitespace-nowrap px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {visibleItems.length ? (
                  visibleItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 font-semibold text-[#063F32]">{item.title}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{getClassDisplay(item)}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{getSubjectDisplay(item)}</td>
                      <td className="px-6 py-4 text-[#245C4F]">{formatDate(item.doc_date)}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {(item.files || []).slice(0, 3).map((f, i) => {
                            const previewUrl = buildPreviewUrl(f.file_url);
                            const content = showTableFilePreviews && f.file_type === 'image' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={previewUrl} alt="preview" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                            ) : showTableFilePreviews && f.file_type === 'video' ? (
                              <video src={previewUrl} className="h-full w-full object-cover pointer-events-none" muted playsInline preload="none" />
                            ) : showTableFilePreviews && f.file_type === 'pdf' ? (
                              <div className="relative h-full w-full overflow-hidden">
                                <iframe
                                  src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`}
                                  className="absolute top-0 left-0 pointer-events-none"
                                  style={{ width: '200%', height: '200%', transform: 'scale(0.5)', transformOrigin: 'top left' }}
                                  tabIndex={-1}
                                  loading="lazy"
                                  title="preview"
                                />
                              </div>
                            ) : (
                              getFileIcon(f.file_type)
                            );

                            return showTableFilePreviews ? (
                              <a
                                key={f.id}
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.original_name || 'View file'}
                                className="h-10 w-10 rounded-xl border border-[#2D8A6A]/20 bg-gray-50 flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                              >
                                {content}
                              </a>
                            ) : (
                              <a
                                key={f.id}
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={f.original_name || 'File'}
                                aria-label={`Open ${f.original_name || 'file'} in a new tab`}
                                className="h-10 w-10 rounded-xl border border-[#2D8A6A]/20 bg-gray-50 flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                              >
                                {content}
                              </a>
                            );
                          })}
                          {(item.files || []).length > 3 && (
                            <div className="h-10 w-10 rounded-xl border border-[#2D8A6A]/20 bg-gray-100 flex items-center justify-center text-xs font-semibold text-[#063F32]">
                              +{(item.files || []).length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setViewingItem(item);
                              setShowViewModal(true);
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                          >
                            View
                          </button>
                          {allowManage && showActionsColumn ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setForm({
                                    title: item.title || "",
                                    description: item.description || "",
                                    courseIds: normalizeIdList(item.course_ids, item.course_id ? [item.course_id] : []),
                                    subjectIds: normalizeIdList(item.subject_ids, item.subject_id ? [item.subject_id] : []),
                                    docDate: item.doc_date ? new Date(item.doc_date).toISOString().split('T')[0] : "",
                                  });
                                  setExistingFiles(item.files || []);
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
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-6 py-10 text-center text-[#245C4F]" colSpan="6">
                      {loading ? "Loading documents..." : "No library documents found."}
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

      {showAddModal && allowManage ? (
        <ClientPortal targetId={portalTargetId}>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/45 px-4 py-8">
            <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-6">
              <div className="mb-6">
                <h3 className="text-2xl font-semibold text-[#063F32]">{editingItem ? "Edit Document" : "Add Library Document"}</h3>
                <p className="mt-1 text-sm text-[#245C4F]">Manage educational resources, videos, and documents.</p>
              </div>

              {error ? <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

              <form className="space-y-4" onSubmit={handleSubmit}>

                <div className="grid gap-4 lg:grid-cols-2">
                  <MultiSelectChecklist
                    label="Classes"
                    options={classes}
                    selectedIds={form.courseIds}
                    onChange={(nextCourseIds) => {
                      setForm((current) => {
                        const allowedSubjectIds = new Set(
                          subjects
                            .filter((subject) => !nextCourseIds.length || nextCourseIds.includes(subject.course_id))
                            .map((subject) => subject.id)
                        );
                        return {
                          ...current,
                          courseIds: nextCourseIds,
                          subjectIds: current.subjectIds.filter((subjectId) => allowedSubjectIds.has(subjectId)),
                        };
                      });
                    }}
                    required
                  />

                  <MultiSelectChecklist
                    label="Subjects"
                    options={formSubjectOptions}
                    selectedIds={form.subjectIds}
                    onChange={(nextSubjectIds) => setForm((current) => ({ ...current, subjectIds: nextSubjectIds }))}
                    required
                    disabled={!form.courseIds.length}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Date *</span>
                    <input
                      type="date"
                      value={form.docDate}
                      onChange={(e) => setForm((c) => ({ ...c, docDate: e.target.value }))}
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-[#245C4F]">Document Title *</span>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                      placeholder="e.g., Chapter 1 Notes"
                      className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6]"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-[#245C4F]">Description *</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                    placeholder="Optional details..."
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:bg-white focus:ring-4 focus:ring-[#FFF5D6] min-h-[80px]"
                  />
                </label>

                <div className="block">
                  <span className="mb-2 flex items-center justify-between text-sm font-medium text-[#245C4F]">
                    <span>Documents *</span>
                  </span>
                  <label className="flex cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-[#2D8A6A]/30 bg-[#FAF7F0] px-4 py-6 transition hover:bg-white hover:border-[#2D8A6A]/50 focus-within:border-[#2D8A6A] focus-within:ring-4 focus-within:ring-[#FFF5D6]">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#0D5C48]/10 text-[#0D5C48]">
                        <Plus size={20} />
                      </div>
                      <span className="text-sm font-semibold text-[#063F32]">Click to upload files</span>
                      <p className="mt-1 text-xs text-[#245C4F]">Maximum file size: {formatUploadLimit()} per file. Attach multiple files if needed.</p>
                    </div>
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
                        setSelectedFiles([...selectedFiles, ...allowedFiles]);
                        e.target.value = null; // reset input
                      }}
                      className="hidden"
                    />
                  </label>

                  {(existingFiles.length > 0 || selectedFiles.length > 0) ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-[#063F32]">Attached Files:</p>
                      <ul className="max-h-32 space-y-1 overflow-auto rounded-xl bg-white/70 p-2">
                        {existingFiles.map((f, i) => (
                          <li key={`ex-${f.id}`} className="flex items-center justify-between text-xs text-[#245C4F] rounded bg-white p-2 border border-[#2D8A6A]/10">
                            <div className="flex items-center gap-2 truncate">
                              {getFileIcon(f.file_type)}
                              <span className="truncate">{f.original_name || 'Document'}</span>
                            </div>
                            <button type="button" onClick={() => setExistingFiles(existingFiles.filter(xf => xf.id !== f.id))} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={12} /></button>
                          </li>
                        ))}
                        {selectedFiles.map((file, i) => (
                          <li key={`sel-${i}`} className="flex items-center justify-between text-xs text-[#245C4F] rounded bg-[#FFF5D6]/40 p-2 border border-[#E4C766]/30">
                            <div className="flex items-center gap-2 truncate">
                              <span className="truncate">{file.name} (New)</span>
                            </div>
                            <button type="button" onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))} className="text-rose-500 hover:text-rose-700 p-1"><Trash2 size={12} /></button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      resetForm();
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

      {showViewModal && viewingItem ? (
        <ClientPortal targetId={portalTargetId}>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/45 px-4 py-8">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)] sm:p-6">
              <div className="mb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-semibold text-[#063F32]">{viewingItem.title}</h3>
                  <p className="mt-1 text-sm text-[#245C4F]">
                    {viewingItem.course_titles || viewingItem.class_level || viewingItem.course_title} &bull; {viewingItem.subject_names || viewingItem.subject_name} &bull; {formatDate(viewingItem.doc_date)}
                  </p>
                </div>
                <button onClick={() => setShowViewModal(false)} className="rounded-full p-2 text-2xl text-[#063F32] hover:scale-120 transition">&times;</button>
              </div>

              {viewingItem.description && (
                <div className="mb-6 rounded-2xl bg-white p-4 border border-[#2D8A6A]/10">
                  <p className="text-sm text-[#063F32] whitespace-pre-wrap">{viewingItem.description}</p>
                </div>
              )}

              <h4 className="text-sm font-semibold text-[#0D5C48] mb-3 uppercase tracking-wider">Attached Documents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(viewingItem.files || []).map((file) => (
                  <div key={file.id} className="rounded-xl border border-[#2D8A6A]/15 bg-white p-3 flex flex-col items-center text-center">
                    <div className="h-40 w-full bg-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {file.file_type === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={buildPreviewUrl(file.file_url)} alt="preview" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : file.file_type === 'video' ? (
                        <video src={buildPreviewUrl(file.file_url)} className="h-full w-full object-cover" muted playsInline controls preload="metadata" />
                      ) : file.file_type === 'pdf' ? (
                        <iframe src={buildPreviewUrl(file.file_url)} className="h-full w-full" loading="lazy" title={file.original_name || 'PDF Preview'} />
                      ) : (
                        <File className="text-gray-500" size={32} />
                      )}
                    </div>
                    <p className="text-xs font-medium text-[#063F32] truncate w-full mb-3">{file.original_name || 'Document'}</p>
                    <button
                      type="button"
                      onClick={() => window.open(buildPreviewUrl(file.file_url), "_blank", "noopener,noreferrer")}
                      className="w-full rounded-lg bg-[#FFF5D6] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#E4C766]"
                    >
                      Open Document
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}

      {allowManage && showDeleteModal ? (
        <ClientPortal targetId={portalTargetId}>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#063F32]/45 px-4 py-8">
            <div className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-5 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <h3 className="text-lg font-semibold text-[#063F32]">Archive Document</h3>
              <p className="mt-3 text-sm text-[#245C4F]">Are you sure you want to archive this document? It will be hidden from teacher and parent portals.</p>

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
                  {submitting ? "Archiving..." : "Archive"}
                </button>
              </div>
            </div>
          </div>
        </ClientPortal>
      ) : null}
    </div>
  );
}
