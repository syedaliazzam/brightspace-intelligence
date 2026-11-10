"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import PizzaPieChart, { getAreaChartData } from "@/components/assessments/PizzaPieChart";
import { downloadTermAssessmentPdf } from "@/lib/termAssessmentPdf";

const OBSERVATION_OPTIONS = ["Achieved", "Developing", "Emerging", "Needs Support"];

function formatScore(rawScore) {
  const num = Number(rawScore);
  if (isNaN(num)) return "0%";
  if (num > 0 && num <= 1) {
    return `${Math.round(num * 100)}%`;
  }
  return `${Math.round(num)}%`;
}

export default function CreateAssessmentClient({
  portal = "coordinator",
  readOnly = false,
}) {
  const portalLabel =
    portal === "superadmin"
      ? "Super Admin portal"
      : portal === "admin"
        ? "Admin portal"
        : "Coordinator portal";

  const [assessments, setAssessments] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // PDF Downloading State
  const [downloadingId, setDownloadingId] = useState(null);

  // Form Fields
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [assessmentName, setAssessmentName] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState("2025-2026");
  const [teacherRemarks, setTeacherRemarks] = useState("");
  const [assessmentRecords, setAssessmentRecords] = useState([]);

  // View / Preview Modal State
  const [previewItem, setPreviewItem] = useState(null);

  const handleDownloadPdf = async (item) => {
    if (!item) return;
    try {
      setDownloadingId(item.id);
      await downloadTermAssessmentPdf(item);
    } catch (err) {
      console.error("Failed to download PDF:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Load Assessments and Students
  const fetchData = useCallback(async () => {
    try {
      const [recordsRes, templatesRes] = await Promise.all([
        fetch("/api/term-assessments/records"),
        fetch("/api/term-assessments/templates"),
      ]);

      const recordsData = await recordsRes.json();
      const templatesData = await templatesRes.json();

      if (recordsRes.ok) {
        setAssessments(recordsData.assessments || []);
        setStudents(recordsData.students || []);
        if (recordsData.classes && recordsData.classes.length > 0) {
          setClasses(recordsData.classes);
        }
      }

      if (templatesRes.ok) {
        setTemplates(templatesData.templates || []);
        if ((!recordsData.classes || recordsData.classes.length === 0) && templatesData.classes) {
          setClasses(templatesData.classes);
        }
      }
    } catch (err) {
      console.error("Error loading assessments data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Filter students by selectedClass
  const availableStudentsForClass = useMemo(() => {
    const list = !selectedClass
      ? students
      : students.filter(
          (s) => (s.class_name || "").toLowerCase() === selectedClass.toLowerCase()
        );
    const seen = new Set();
    return list.filter((s) => {
      if (!s?.id || seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [students, selectedClass]);

  // Filter templates by selectedClass
  const availableTemplatesForClass = useMemo(() => {
    const list = !selectedClass
      ? templates
      : templates.filter(
          (t) => (t.class_name || "").toLowerCase() === selectedClass.toLowerCase()
        );
    const seen = new Set();
    return list.filter((t) => {
      if (!t?.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [templates, selectedClass]);

  // When selectedTemplateId changes, populate assessmentRecords
  const handleTemplateSelect = (tmplId) => {
    setSelectedTemplateId(tmplId);
    if (!tmplId) {
      setAssessmentName("");
      setAcademicYear("");
      setTerm("");
      setAssessmentRecords([]);
      return;
    }

    const tmpl = templates.find((t) => t.id === tmplId);
    if (!tmpl) return;

    setAssessmentName(tmpl.name || "");
    setAcademicYear(tmpl.academic_year || "2025-2026");

    const nameLower = (tmpl.name || "").toLowerCase();
    if (nameLower.includes("final")) {
      setTerm("Final Term");
    } else if (nameLower.includes("mid")) {
      setTerm("Mid Term");
    } else if (nameLower.includes("term 2")) {
      setTerm("Term 2");
    } else {
      setTerm("Term 1");
    }

    const areas = Array.isArray(tmpl.learning_areas)
      ? tmpl.learning_areas
      : typeof tmpl.learning_areas === "string"
        ? JSON.parse(tmpl.learning_areas || "[]")
        : [];

    const builtRecords = areas.map((area) => ({
      area_name: area.name || "",
      skills: (area.skills || []).map((sk) => ({
        skill_name: typeof sk === "string" ? sk : sk.name || "",
        score: 100,
        observation: "Achieved",
      })),
    }));

    setAssessmentRecords(builtRecords);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    if (readOnly) return;
    setEditingAssessment(null);
    setSelectedClass("");
    setSelectedStudentId("");
    setSelectedTemplateId("");
    setAssessmentName("");
    setTerm("");
    setAcademicYear("");
    setTeacherRemarks("");
    setAssessmentRecords([]);
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    if (readOnly) return;
    setEditingAssessment(item);
    setSelectedClass(item.class_name || "");
    setSelectedStudentId(item.student_id || "");
    setSelectedTemplateId(item.template_id || "");
    setAssessmentName(item.template_name || item.assessment_name || "Term Assessment");
    setTerm(item.term || "Term 1");
    setAcademicYear(item.academic_year || "2025-2026");
    setTeacherRemarks(item.teacher_remarks || "");

    const recs = Array.isArray(item.records)
      ? item.records
      : typeof item.records === "string"
        ? JSON.parse(item.records || "[]")
        : [];

    const normalizedRecs = recs.map((area) => ({
      ...area,
      skills: (area.skills || []).map((sk) => {
        let sc = Number(sk.score);
        if (isNaN(sc)) sc = 100;
        if (sc > 0 && sc <= 1) {
          sc = Math.round(sc * 100);
        }
        return { ...sk, score: sc };
      }),
    }));

    setAssessmentRecords(normalizedRecs);
    setFormError("");
    setFormSuccess("");
    setIsModalOpen(true);
  };

  // Score & Observation changers
  const handleScoreChange = (areaIdx, skillIdx, scoreVal) => {
    setAssessmentRecords((prev) => {
      const next = [...prev];
      const area = { ...next[areaIdx] };
      const skills = [...area.skills];
      let num = scoreVal === "" ? "" : Number(scoreVal);
      if (typeof num === "number" && !isNaN(num)) {
        if (num < 0) num = 0;
        if (num > 100) num = 100;
      }
      skills[skillIdx] = { ...skills[skillIdx], score: num };
      area.skills = skills;
      next[areaIdx] = area;
      return next;
    });
  };

  const handleObservationChange = (areaIdx, skillIdx, obsVal) => {
    setAssessmentRecords((prev) => {
      const next = [...prev];
      const area = { ...next[areaIdx] };
      const skills = [...area.skills];
      skills[skillIdx] = { ...skills[skillIdx], observation: obsVal };
      area.skills = skills;
      next[areaIdx] = area;
      return next;
    });
  };

  // Submit Save & Publish
  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setFormError("");
    setFormSuccess("");

    if (!selectedClass) {
      setFormError("Please select a class.");
      return;
    }
    if (!selectedStudentId) {
      setFormError("Please select a student.");
      return;
    }
    if (!selectedTemplateId) {
      setFormError("Please select an assessment template.");
      return;
    }
    if (!assessmentRecords.length) {
      setFormError("Please select a template with valid learning areas.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editingAssessment;
      const url = "/api/term-assessments/records";
      const method = isEdit ? "PUT" : "POST";

      const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
      const finalAssessmentName =
        selectedTemplate?.name || assessmentName || editingAssessment?.template_name || "Term Assessment";
      const finalAcademicYear =
        selectedTemplate?.academic_year || academicYear || "2025-2026";

      const payload = {
        id: editingAssessment?.id,
        template_id: selectedTemplateId || null,
        assessment_name: finalAssessmentName,
        student_id: selectedStudentId,
        class_name: selectedClass,
        term: term || "Term 1",
        academic_year: finalAcademicYear,
        status: "PUBLISHED",
        teacher_remarks: teacherRemarks,
        records: assessmentRecords,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save assessment.");
      }

      setFormSuccess(
        isEdit ? "Assessment updated successfully!" : "Assessment published successfully!"
      );
      setTimeout(() => {
        setIsModalOpen(false);
        setLoading(true);
        fetchData();
      }, 700);
    } catch (err) {
      setFormError(err.message || "Failed to save assessment.");
    } finally {
      setSaving(false);
    }
  };

  // Confirm Delete Assessment
  const confirmDeleteAssessment = async () => {
    if (readOnly || !deleteTarget?.id) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/term-assessments/records?id=${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteTarget(null);
        setLoading(true);
        fetchData();
      } else {
        const d = await res.json();
        alert(d.message || "Failed to delete.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete assessment.");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedClassFilter("all");
  };

  // Filtered List
  const filteredAssessments = useMemo(() => {
    return assessments.filter((a) => {
      const matchesSearch =
        (a.student_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.admission_no || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.template_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClass =
        selectedClassFilter === "all" ||
        (a.class_name || "").toLowerCase() === selectedClassFilter.toLowerCase();
      return matchesSearch && matchesClass;
    });
  }, [assessments, searchQuery, selectedClassFilter]);

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
              {readOnly ? "Term Assessments" : "Student Assessments"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">
              {readOnly
                ? "View published student term assessments, learning area performance charts, and teacher observations."
                : "Record student evaluations against defined assessment templates, scores, and teacher observations."}
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
                  <span>Create Assessment</span>
                </span>
              </button>
            )}

            {/* Stat Summary Cards */}
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-3">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold text-lg">{assessments.length}</p>
                <p className="text-xs text-[#EAF6EF]">Assessments</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3">
                <p className="font-semibold text-lg">{students.length}</p>
                <p className="text-xs text-[#EAF6EF]">Students</p>
              </div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 col-span-2 sm:col-span-1">
                <p className="font-semibold text-lg">{classes.length}</p>
                <p className="text-xs text-[#EAF6EF]">Classes</p>
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
              Search Student / Template
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
              <input
                type="text"
                placeholder="Search student name, roll number..."
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
          Showing {filteredAssessments.length} of {assessments.length} assessments
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-6 w-6 animate-spin text-[#0D5C48]" />
              <span className="ml-2.5 text-sm font-semibold text-[#063F32]">Loading records...</span>
            </div>
          ) : filteredAssessments.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-[#2D8A6A]/40" />
              <h3 className="mt-3 text-base font-bold text-[#063F32]">No Assessment Records Found</h3>
              <p className="mt-1 text-xs text-[#245C4F]">
                {readOnly
                  ? "No term assessment records have been published yet."
                  : 'Click the "Create Assessment" button above to evaluate a student.'}
              </p>
            </div>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Student</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Class</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Assessment / Template</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Term</th>
                  <th className="px-6 py-4 font-bold whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-right font-bold whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {filteredAssessments.map((item) => (
                  <tr key={item.id} className="transition hover:bg-[#FAF7F0]/60">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-[#063F32]">{item.student_name}</div>
                      <div className="text-xs text-[#245C4F]">
                        {item.admission_no ? `Roll: ${item.admission_no}` : ""}
                        {item.father_name ? ` • S/D of ${item.father_name}` : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-1 text-xs font-semibold text-[#0D5C48]">
                        {item.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#245C4F] font-medium whitespace-nowrap">
                      {item.template_name || "Custom Assessment"}
                    </td>
                    <td className="px-6 py-4 text-[#245C4F] whitespace-nowrap">
                      {item.term} ({item.academic_year})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                          item.status === "PUBLISHED"
                            ? "bg-[#EAF6EF] text-[#0D5C48]"
                            : "bg-[#F1EADC] text-[#7A5E2B]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* View Preview Button */}
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                          title="Preview Charts & Data"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>

                        {/* Download Report PDF */}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(item)}
                          disabled={downloadingId === item.id}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#0D5C48] transition hover:bg-[#FAF7F0] disabled:opacity-60"
                          title="Download Term Assessment Report PDF"
                        >
                          {downloadingId === item.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0D5C48]" />
                          ) : (
                            <Download className="h-3.5 w-3.5 text-[#0D5C48]" />
                          )}
                          <span>Download Report</span>
                        </button>

                        {!readOnly && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC]"
                              title="Edit Assessment"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                              title="Delete Assessment"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* POPUP MODAL: Create / Edit Student Assessment (Full-access roles only) */}
      {!readOnly && isModalOpen && (
        <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <p className="text-[13px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">
                  {portalLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {editingAssessment ? "Edit Student Assessment" : "Create Student Assessment"}
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

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6">
              <form onSubmit={handleSaveAssessment} className="space-y-5">
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
                    Student &amp; Template Selection
                  </p>
                  <p className="mt-1 text-xs text-[#245C4F]">
                    Choose the class, student, and assessment template to auto-populate the evaluation criteria.
                  </p>
                </div>

                {/* Step 1: Select Class, Student, Template */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Class */}
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        1. Class <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative">
                        <select
                          value={selectedClass}
                          onChange={(e) => {
                            const newCls = e.target.value;
                            setSelectedClass(newCls);
                            setSelectedStudentId("");
                            setSelectedTemplateId("");
                            setAssessmentRecords([]);
                            setAssessmentName("");
                            setTerm("");
                            setAcademicYear("");
                          }}
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

                  {/* Student */}
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        2. Student <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative">
                        <select
                          value={selectedStudentId}
                          onChange={(e) => setSelectedStudentId(e.target.value)}
                          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                        >
                          <option value="">-- Select Student --</option>
                          {availableStudentsForClass.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.student_name} {st.admission_no ? `(${st.admission_no})` : ""}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#245C4F]" />
                      </div>
                    </label>
                  </div>

                  {/* Template */}
                  <div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                        3. Template <span className="text-rose-500">*</span>
                      </span>
                      <div className="relative">
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => handleTemplateSelect(e.target.value)}
                          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-10 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                        >
                          <option value="">-- Select Template --</option>
                          {availableTemplatesForClass.map((tmpl) => (
                            <option key={tmpl.id} value={tmpl.id}>
                              {tmpl.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#245C4F]" />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Selected Template Details Banner */}
                {(() => {
                  const currentTemplate = templates.find((t) => t.id === selectedTemplateId);
                  if (!currentTemplate) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] px-4 py-3 text-xs text-[#245C4F]">
                      <span className="font-bold uppercase tracking-wider text-[#0D5C48]">
                        Assessment Template:
                      </span>
                      <span className="font-semibold text-[#063F32]">
                        {currentTemplate.name}
                      </span>
                      {currentTemplate.academic_year && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="font-bold uppercase tracking-wider text-[#0D5C48]">
                            Academic Year:
                          </span>
                          <span className="font-semibold text-[#063F32]">
                            {currentTemplate.academic_year}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Evaluation Criteria Form */}
                <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-[#F7F2E8] p-4 space-y-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227]">
                      Evaluation Form (Scores &amp; Teacher Observations)
                    </p>
                    <p className="mt-0.5 text-xs text-[#245C4F]">
                      Record individual percentage scores (0-100%) and observations (Achieved / Developing) for each skill.
                    </p>
                  </div>

                  {assessmentRecords.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#2D8A6A]/25 bg-white p-8 text-center text-xs text-[#245C4F]">
                      Please select an Assessment Template above to load learning areas and skills.
                    </div>
                  ) : (
                    assessmentRecords.map((area, aIdx) => (
                      <div
                        key={aIdx}
                        className="rounded-2xl border border-[#2D8A6A]/15 bg-white p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 pb-2">
                          <span className="text-sm font-bold text-[#0D5C48]">
                            {area.area_name || `Learning Area #${aIdx + 1}`}
                          </span>
                          <span className="rounded-full bg-[#FAF7F0] border border-[#2D8A6A]/15 px-2.5 py-0.5 text-xs font-semibold text-[#063F32]">
                            {area.skills?.length || 0} Skills
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {(area.skills || []).map((skill, sIdx) => (
                            <div
                              key={sIdx}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[#FAF7F0]/70 p-3 border border-[#2D8A6A]/10"
                            >
                              <div className="flex-1">
                                <span className="text-xs font-bold text-[#063F32]">
                                  {skill.skill_name}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                {/* Score (0-100%) */}
                                <div className="w-28">
                                  <span className="block text-[10px] font-bold uppercase text-[#0D5C48] mb-0.5">
                                    Score (0-100%)
                                  </span>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      max="100"
                                      placeholder="100"
                                      value={skill.score}
                                      onChange={(e) =>
                                        handleScoreChange(aIdx, sIdx, e.target.value)
                                      }
                                      className="w-full rounded-xl border border-[#2D8A6A]/20 bg-white px-2.5 py-1 pr-6 text-xs font-bold text-[#063F32] outline-none focus:border-[#2D8A6A]"
                                    />
                                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#0D5C48]">
                                      %
                                    </span>
                                  </div>
                                </div>

                                {/* Observation */}
                                <div className="w-40">
                                  <span className="block text-[10px] font-bold uppercase text-[#0D5C48] mb-0.5">
                                    Observation
                                  </span>
                                  <div className="relative">
                                    <select
                                      value={skill.observation}
                                      onChange={(e) =>
                                        handleObservationChange(aIdx, sIdx, e.target.value)
                                      }
                                      className="w-full appearance-none rounded-xl border border-[#2D8A6A]/20 bg-white px-2.5 py-1 pr-7 text-xs font-semibold text-[#063F32] outline-none focus:border-[#2D8A6A]"
                                    >
                                      {OBSERVATION_OPTIONS.map((opt, oIdx) => (
                                        <option key={oIdx} value={opt}>
                                          {opt}
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#245C4F]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Remarks */}
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-[#245C4F]">
                    Teacher Remarks / Observations
                  </span>
                  <textarea
                    rows={3}
                    value={teacherRemarks}
                    onChange={(e) => setTeacherRemarks(e.target.value)}
                    placeholder="e.g. Student demonstrates great active listening and motor tracing proficiency..."
                    className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] focus:ring-2 focus:ring-[#FFF5D6]"
                  />
                </label>

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
                        <span>{editingAssessment ? "Save changes" : "Publish assessment"}</span>
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

      {/* VIEW / PREVIEW MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-[10020] flex items-start justify-center overflow-x-hidden overflow-y-auto bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm sm:py-10">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,247,240,0.99))] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.3)]">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#2D8A6A]/10 px-6 py-5">
              <div>
                <span className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0D5C48]">
                  {previewItem.class_name} • {previewItem.term} ({previewItem.academic_year})
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#063F32]">
                  {previewItem.student_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] transition hover:bg-white cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
              {/* Performance Breakdown Charts */}
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227] mb-3">
                  Learning Area Performance Breakdown
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(Array.isArray(previewItem.records) ? previewItem.records : []).map(
                    (area, idx) => {
                      const skills = area.skills || [];
                      const { chartData, badge } = getAreaChartData(skills);

                      return (
                        <PizzaPieChart
                          key={idx}
                          title={area.area_name}
                          subtitle={`${skills.length} Outcomes`}
                          badge={badge}
                          data={chartData}
                        />
                      );
                    }
                  )}
                </div>
              </div>

              {/* Outcomes Table */}
              <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A227] mb-3">
                  Detailed Learning Outcomes &amp; Teacher Observations
                </p>
                <div className="overflow-x-auto rounded-xl border border-[#F1EADC]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-[#0D5C48] font-bold uppercase tracking-wider">
                        <th className="p-3">Learning Area</th>
                        <th className="p-3">Skill / Outcome</th>
                        <th className="p-3">Score (%)</th>
                        <th className="p-3">Observation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1EADC]">
                      {(Array.isArray(previewItem.records) ? previewItem.records : []).flatMap(
                        (area, aIdx) =>
                          (area.skills || []).map((skill, sIdx) => (
                            <tr key={`${aIdx}-${sIdx}`} className="hover:bg-[#FAF7F0]/60">
                              <td className="p-3 font-bold text-[#063F32]">
                                {sIdx === 0 ? area.area_name : ""}
                              </td>
                              <td className="p-3 text-[#245C4F]">{skill.skill_name}</td>
                              <td className="p-3 font-bold text-[#0D5C48]">
                                {formatScore(skill.score)}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                    String(skill.observation || "")
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
              </div>

              {previewItem.teacher_remarks && (
                <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FFF5D6]/35 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0D5C48] mb-1">
                    Teacher Remarks
                  </p>
                  <p className="text-sm text-[#245C4F] leading-relaxed">
                    {previewItem.teacher_remarks}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#2D8A6A]/10 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => handleDownloadPdf(previewItem)}
                disabled={downloadingId === previewItem.id}
                className="inline-flex items-center gap-2 rounded-full bg-[#0D5C48] px-6 py-2.5 text-xs font-bold text-[#FAF7F0] shadow-xs transition hover:bg-[#063F32] active:scale-95 cursor-pointer disabled:opacity-60"
              >
                {downloadingId === previewItem.id ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#FAF7F0]" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-[#FAF7F0]" />
                )}
                <span>{downloadingId === previewItem.id ? "Preparing PDF..." : "Download Report"}</span>
              </button>
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
                Remove student assessment?
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#245C4F]">
                This will permanently delete the assessment report for <span className="font-bold text-[#063F32]">{deleteTarget.student_name}</span> ({deleteTarget.class_name} • {deleteTarget.term}). This action cannot be undone.
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
                onClick={confirmDeleteAssessment}
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

