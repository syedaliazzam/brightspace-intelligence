"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
  BookOpen,
  Trash,
} from "lucide-react";

// Helper to generate IDs
let idCounter = 1;
function getUniqueId(prefix = "id") {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).slice(2, 7)}`;
}

// Default sample rubric matching reference structure
const DEFAULT_SAMPLE_AREAS = [
  {
    id: "la-1",
    name: "English Language",
    skills: [
      { id: "sk-1-1", name: "Sound recognition" },
      { id: "sk-1-2", name: "letter tracing" },
    ],
  },
  {
    id: "la-2",
    name: "Urdu Language",
    skills: [
      { id: "sk-2-1", name: "Sound recognition" },
      { id: "sk-2-2", name: "Huroof tracing" },
    ],
  },
  {
    id: "la-3",
    name: "Islamic learning",
    skills: [
      { id: "sk-3-1", name: "Dua" },
      { id: "sk-3-2", name: "Hadith" },
    ],
  },
  {
    id: "la-4",
    name: "Mathematics",
    skills: [
      { id: "sk-4-1", name: "Number recognition" },
      { id: "sk-4-2", name: "Number tracing" },
    ],
  },
  {
    id: "la-5",
    name: "Discovery",
    skills: [{ id: "sk-5-1", name: "Generl Knowledge" }],
  },
  {
    id: "la-6",
    name: "Social Emotional learning",
    skills: [
      { id: "sk-6-1", name: "online participation" },
      { id: "sk-6-2", name: "following instructions" },
      { id: "sk-6-3", name: "Attention span" },
    ],
  },
];

export default function AssessmentTemplatesClient({
  portal = "coordinator",
  readOnly = false,
}) {
  const portalLabel =
    portal === "superadmin"
      ? "Super Admin portal"
      : portal === "admin"
        ? "Admin portal"
        : "Coordinator portal";

  const [templates, setTemplates] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Read-only View Modal State
  const [viewTemplate, setViewTemplate] = useState(null);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form Fields
  const [templateName, setTemplateName] = useState("");
  const [templateClass, setTemplateClass] = useState("PlayGroup");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [description, setDescription] = useState("");
  const [learningAreas, setLearningAreas] = useState([]);

  // Fetch templates from API
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/term-assessments/templates");
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
        if (data.classes && data.classes.length > 0) {
          setClasses(data.classes);
        }
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates();
  }, [fetchTemplates]);

  // Open modal for Create
  const handleOpenCreate = () => {
    if (readOnly) return;
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateClass("");
    setAcademicYear("2025-2026");
    setDescription("");
    setLearningAreas([
      {
        id: getUniqueId("la"),
        name: "",
        skills: [{ id: getUniqueId("sk"), name: "" }],
      },
    ]);
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (tmpl) => {
    if (readOnly) return;
    setEditingTemplate(tmpl);
    setTemplateName(tmpl.name || "");
    setTemplateClass(tmpl.class_name || "");
    setAcademicYear(tmpl.academic_year || "2025-2026");
    setDescription(tmpl.description || "");

    const parsedAreas = Array.isArray(tmpl.learning_areas)
      ? tmpl.learning_areas
      : typeof tmpl.learning_areas === "string"
        ? JSON.parse(tmpl.learning_areas || "[]")
        : [];

    setLearningAreas(
      parsedAreas.length > 0
        ? parsedAreas
        : [
            {
              id: getUniqueId("la"),
              name: "",
              skills: [{ id: getUniqueId("sk"), name: "" }],
            },
          ]
    );
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Quick Load Sample Data into Form
  const handleLoadSampleRubric = () => {
    if (readOnly) return;
    setLearningAreas(JSON.parse(JSON.stringify(DEFAULT_SAMPLE_AREAS)));
  };

  // Learning Area Handlers
  const addLearningArea = () => {
    const newId = getUniqueId("la");
    setLearningAreas((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        skills: [{ id: getUniqueId("sk"), name: "" }],
      },
    ]);

    setTimeout(() => {
      const el = document.getElementById(`area-name-input-${newId}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  const removeLearningArea = (areaIndex) => {
    setLearningAreas((prev) => prev.filter((_, idx) => idx !== areaIndex));
  };

  const updateAreaName = (areaIndex, name) => {
    setLearningAreas((prev) => {
      const next = [...prev];
      next[areaIndex] = { ...next[areaIndex], name };
      return next;
    });
  };

  // Skill Handlers
  const addSkill = (areaIndex) => {
    const newSkillId = getUniqueId("sk");
    setLearningAreas((prev) => {
      const next = [...prev];
      const area = next[areaIndex];
      const skills = Array.isArray(area.skills) ? [...area.skills] : [];
      skills.push({ id: newSkillId, name: "" });
      next[areaIndex] = { ...area, skills };
      return next;
    });

    setTimeout(() => {
      const el = document.getElementById(`skill-input-${newSkillId}`);
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
  };

  const removeSkill = (areaIndex, skillIndex) => {
    setLearningAreas((prev) => {
      const next = [...prev];
      const area = next[areaIndex];
      const skills = (area.skills || []).filter((_, idx) => idx !== skillIndex);
      next[areaIndex] = { ...area, skills };
      return next;
    });
  };

  const updateSkillName = (areaIndex, skillIndex, name) => {
    setLearningAreas((prev) => {
      const next = [...prev];
      const area = next[areaIndex];
      const skills = [...(area.skills || [])];
      skills[skillIndex] = { ...skills[skillIndex], name };
      next[areaIndex] = { ...area, skills };
      return next;
    });
  };

  // Submit Handler
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setFormError("");
    setFormSuccess("");

    if (!templateName.trim()) {
      setFormError("Please enter Assessment Name.");
      return;
    }
    if (!templateClass.trim()) {
      setFormError("Please select a Class.");
      return;
    }

    const cleanedAreas = learningAreas
      .map((area) => ({
        id: area.id || getUniqueId("la"),
        name: area.name.trim(),
        skills: (area.skills || [])
          .map((s) => ({
            id: s.id || getUniqueId("sk"),
            name: s.name.trim(),
          }))
          .filter((s) => s.name.length > 0),
      }))
      .filter((area) => area.name.length > 0);

    if (cleanedAreas.length === 0) {
      setFormError("Please add at least one Learning Area with skills.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editingTemplate;
      const url = "/api/term-assessments/templates";
      const method = isEdit ? "PUT" : "POST";
      const payload = {
        id: editingTemplate?.id,
        name: templateName.trim(),
        class_name: templateClass.trim(),
        academic_year: academicYear,
        description,
        learning_areas: cleanedAreas,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save template.");
      }

      setFormSuccess(isEdit ? "Template updated successfully!" : "Template created successfully!");
      setTimeout(() => {
        setIsModalOpen(false);
        setLoading(true);
        fetchTemplates();
      }, 700);
    } catch (err) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Handler
  const confirmDeleteTemplate = async () => {
    if (readOnly || !deleteTarget?.id) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/term-assessments/templates?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setLoading(true);
        fetchTemplates();
      } else {
        const d = await res.json();
        alert(d.message || "Failed to delete.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete template.");
    } finally {
      setDeleting(false);
    }
  };

  // Reset filter
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedClassFilter("all");
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        (t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.class_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass =
        selectedClassFilter === "all" ||
        (t.class_name || "").toLowerCase() === selectedClassFilter.toLowerCase();
      return matchesSearch && matchesClass;
    });
  }, [templates, searchQuery, selectedClassFilter]);

  // Total summary calculations
  const totalSkillsCount = useMemo(() => {
    return templates.reduce((sum, item) => {
      const areas = Array.isArray(item.learning_areas) ? item.learning_areas : [];
      return sum + areas.reduce((aSum, a) => aSum + (Array.isArray(a.skills) ? a.skills.length : 0), 0);
    }, 0);
  }, [templates]);

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 text-[#063F32]">
      {/* Hero Header Section */}
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">
              {portalLabel}
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Assessment Templates
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              {readOnly
                ? "View assessment templates, learning areas, and defined evaluation outcomes."
                : "Create assessment templates, manage learning areas and outcomes, and configure class evaluations."}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            {!readOnly && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="rounded-2xl bg-[#FFF5D6] px-5 py-3 text-sm font-semibold text-[#0D5C48] shadow-sm transition hover:bg-white active:scale-95"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Assessment Template</span>
                </span>
              </button>
            )}

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold text-lg">{templates.length}</p>
                <p className="text-xs text-[#EAF6EF]">Templates</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold text-lg">{classes.length}</p>
                <p className="text-xs text-[#EAF6EF]">Classes</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 col-span-2 sm:col-span-1">
                <p className="font-semibold text-lg">{totalSkillsCount}</p>
                <p className="text-xs text-[#EAF6EF]">Total Outcomes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Table Section */}
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6 shadow-[0_20px_70px_-40px_rgba(13,59,46,0.2)]">
        {/* Filters Grid */}
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              Class
            </span>
            <div className="relative">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              >
                <option value="all">All Classes</option>
                {classes.map((cls, idx) => (
                  <option key={idx} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48]" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">
              Search Template / Class
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
              <input
                type="text"
                placeholder="Search by name or class..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
              />
            </div>
          </label>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filters
            </button>
          </div>
        </div>

        {/* Record count bar */}
        <div className="mt-4 border-b border-[#2D8A6A]/10 pb-3 text-right text-sm font-semibold text-[#245C4F]">
          Showing {filteredTemplates.length} of {templates.length} templates
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-[#0D5C48]" />
              <span className="ml-2.5 text-sm font-semibold text-[#063F32]">Loading templates...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-[#2D8A6A]/40" />
              <h3 className="mt-3 text-base font-bold text-[#063F32]">No Assessment Templates Found</h3>
              <p className="mt-1 text-xs text-[#245C4F]">
                {readOnly
                  ? "No assessment templates have been created yet."
                  : 'Click the "Create Assessment Template" button above to create one.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Assessment Name</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Class</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Learning Areas</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Outcomes</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Academic Year</th>
                  <th className="px-6 py-4 text-right font-bold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {filteredTemplates.map((item) => {
                  const areas = Array.isArray(item.learning_areas)
                    ? item.learning_areas
                    : typeof item.learning_areas === "string"
                      ? JSON.parse(item.learning_areas || "[]")
                      : [];
                  const totalSkills = areas.reduce(
                    (acc, a) => acc + (Array.isArray(a.skills) ? a.skills.length : 0),
                    0
                  );

                  return (
                    <tr key={item.id} className="transition hover:bg-[#FAF7F0]/60">
                      <td className="px-6 py-4 font-semibold text-[#063F32] whitespace-nowrap">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-1 text-xs font-semibold text-[#0D5C48]">
                          {item.class_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[#245C4F] font-medium whitespace-nowrap">
                        {areas.length} Areas
                      </td>
                      <td className="px-6 py-4 text-[#245C4F] font-medium whitespace-nowrap">
                        {totalSkills} Skills
                      </td>
                      <td className="px-6 py-4 text-[#245C4F] whitespace-nowrap">
                        {item.academic_year || "2025-2026"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setViewTemplate({ ...item, parsedAreas: areas })}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </button>

                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(item)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* READ-ONLY VIEW MODAL */}
      {viewTemplate && (
        <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#C9A227]">
                  Assessment Template Details
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {viewTemplate.name}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#245C4F]">
                  <span className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-1 font-semibold text-[#0D5C48]">
                    Class: {viewTemplate.class_name}
                  </span>
                  <span className="rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-1 font-semibold text-[#063F32]">
                    Academic Year: {viewTemplate.academic_year || "2025-2026"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewTemplate(null)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
              {viewTemplate.description && (
                <div className="rounded-2xl border border-[#E4C766]/35 bg-[#FFF5D6]/35 p-4 text-sm text-[#245C4F]">
                  {viewTemplate.description}
                </div>
              )}

              {(viewTemplate.parsedAreas || []).map((area, aIdx) => (
                <div
                  key={area.id || aIdx}
                  className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-4 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-[#F1EADC] pb-2">
                    <h3 className="text-sm font-bold text-[#063F32]">
                      {area.name}
                    </h3>
                    <span className="rounded-full border border-[#2D8A6A]/15 bg-[#FAF7F0] px-2.5 py-0.5 text-xs font-semibold text-[#0D5C48]">
                      {(area.skills || []).length} Skills
                    </span>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {(area.skills || []).map((skill, sIdx) => (
                      <li key={skill.id || sIdx} className="flex items-center gap-2 text-xs text-[#245C4F]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#2D8A6A]" />
                        <span>{typeof skill === "string" ? skill : skill.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="border-t border-[#2D8A6A]/10 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewTemplate(null)}
                className="rounded-full bg-[#0D5C48] px-5 py-2 text-xs font-semibold text-[#FFF5D6] transition hover:bg-[#063F32]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT POPUP MODAL (Full-access roles only) */}
      {!readOnly && isModalOpen && (
        <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
                  Assessment Template
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {editingTemplate ? "Edit Assessment Template" : "Create Assessment Template"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
              >
                Close
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6">
              <form onSubmit={handleSaveTemplate} className="space-y-5">
                {formError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div className="rounded-2xl border border-[#2D8A6A]/30 bg-[#EAF6EF] px-4 py-3 text-sm text-[#0D5C48]">
                    {formSuccess}
                  </div>
                )}

                {/* Section Notice Banner */}
                <div className="rounded-xl border border-[#E4C766]/40 bg-[#FFF5D6]/45 px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0D5C48]">
                    Template details
                  </p>
                  <p className="mt-1 text-xs text-[#245C4F]">
                    Define the assessment name, select the target class, and build learning area rubrics.
                  </p>
                </div>

                {/* Form Fields Grid */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Field 1: Assessment Name */}
                  <div className="sm:col-span-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        Assessment Name <span className="text-rose-500">*</span>
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. PlayGroup Term 1 Assessment"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                      />
                    </label>
                  </div>

                  {/* Field 2: Class */}
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        Class <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative">
                        <select
                          value={templateClass}
                          onChange={(e) => setTemplateClass(e.target.value)}
                          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                        >
                          <option value="">-- Select Class --</option>
                          {classes.map((cls, idx) => (
                            <option key={idx} value={cls}>
                              {cls}
                            </option>
                          ))}
                          {!classes.includes("PlayGroup") && (
                            <option value="PlayGroup">PlayGroup</option>
                          )}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#245C4F]" />
                      </div>
                    </label>
                  </div>

                  {/* Field 3: Academic Year */}
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        Academic Year
                      </span>
                      <input
                        type="text"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        placeholder="2025-2026"
                        className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                      />
                    </label>
                  </div>
                </div>

                {/* Quick Sample Rubric Loader */}
                {!editingTemplate && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#F7F2E8] p-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                        Quick Pre-Fill
                      </p>
                      <p className="mt-1 text-sm text-[#245C4F]">
                        Load reference PlayGroup subjects (English, Urdu, Islamic, Math, Discovery, SEL).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadSampleRubric}
                      className="rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FFF5D6] transition hover:bg-[#063F32]"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Load Sample</span>
                      </span>
                    </button>
                  </div>
                )}

                {/* Dynamic Learning Areas Builder */}
                <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#F7F2E8] p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2D8A6A]/10 pb-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                        Learning Areas &amp; Outcomes Builder
                      </p>
                      <p className="mt-0.5 text-xs text-[#245C4F]">
                        Configure subject categories and specific evaluation outcomes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addLearningArea}
                      className="rounded-full bg-[#0D5C48] px-4 py-2 text-xs font-semibold text-[#FFF5D6] transition hover:bg-[#063F32]"
                    >
                      + Add Learning Area
                    </button>
                  </div>

                  <div className="space-y-3">
                    {learningAreas.map((area, aIdx) => (
                      <div
                        key={area.id || aIdx}
                        className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#0D5C48] mb-1">
                              Learning Area #{aIdx + 1}
                            </span>
                            <input
                              id={`area-name-input-${area.id || aIdx}`}
                              type="text"
                              required
                              placeholder="e.g. English Language, Mathematics, Urdu Language"
                              value={area.name}
                              onChange={(e) => updateAreaName(aIdx, e.target.value)}
                              className="w-full rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3.5 py-2 text-sm font-semibold text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#0D5C48]/20 transition-all"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLearningArea(aIdx)}
                            className="mt-4 rounded-xl border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50 transition"
                            title="Remove area"
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Skills Sub-list */}
                        <div className="ml-2 border-l-2 border-[#2D8A6A]/20 pl-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C9A227]">
                              Skills / Learning Outcomes
                            </span>
                            <button
                              type="button"
                              onClick={() => addSkill(aIdx)}
                              className="text-xs font-bold text-[#0D5C48] hover:underline"
                            >
                              + Add Skill
                            </button>
                          </div>

                          {(area.skills || []).map((skill, sIdx) => (
                            <div key={skill.id || sIdx} className="flex items-center gap-2">
                              <input
                                id={`skill-input-${skill.id || sIdx}`}
                                type="text"
                                required
                                placeholder="e.g. Sound recognition, letter tracing, number tracing"
                                value={skill.name}
                                onChange={(e) => updateSkillName(aIdx, sIdx, e.target.value)}
                                className="flex-1 rounded-xl border border-[#2D8A6A]/15 bg-white px-3 py-1.5 text-xs text-[#063F32] outline-none focus:border-[#2D8A6A]"
                              />
                              {(area.skills || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSkill(aIdx, sIdx)}
                                  className="text-gray-400 hover:text-rose-600 transition"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 border-t border-[#2D8A6A]/10 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] px-5 py-3 text-sm font-semibold text-[#FFF5D6] shadow-[0_16px_34px_-24px_rgba(13,59,46,0.65)] transition hover:opacity-95 disabled:opacity-70"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" />
                        <span>{editingTemplate ? "Save changes" : "Create template"}</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="inline-flex items-center rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* THEME DELETE CONFIRMATION MODAL (Full-access roles only) */}
      {!readOnly && deleteTarget && (
        <div className="fixed inset-0 z-[10030] flex items-center justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] p-6 sm:p-7 shadow-[0_28px_90px_-40px_rgba(13,59,46,0.35)]">
            <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 pb-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#C9A227]">
                Delete confirmation
              </p>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full p-1 text-[#245C4F] hover:bg-[#F1EADC] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4">
              <h3 className="text-xl font-bold tracking-tight text-[#063F32]">
                Remove this assessment template?
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#245C4F]">
                This will permanently delete <span className="font-bold text-[#063F32]">&quot;{deleteTarget.name}&quot;</span> for <span className="font-semibold text-[#063F32]">{deleteTarget.class_name}</span>. This action cannot be undone.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-[#2D8A6A]/10 pt-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTemplate}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-70"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>Delete now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

