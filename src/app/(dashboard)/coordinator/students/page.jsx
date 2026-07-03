"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import StudentTable from "@/components/coordinator/StudentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";
import { OpenBookLoader } from "@/components/shared/AshShajrahLoaders";

export default function CoordinatorStudentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [search, setSearch] = useState("");
  const [classLevel, setClassLevel] = useState("");
  const [classOpen, setClassOpen] = useState(false);

  function closeSelectState() {
    setClassOpen(false);
  }

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    const response = await fetch("/api/coordinator/students", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Unable to load students.");
    }

    setState({ items: data.items || [], loading: false, error: "" });
  }, []);

  useEffect(() => {
    load().catch((error) =>
      setState({ items: [], loading: false, error: error.message })
    );
  }, [load]);

  const filteredItems = useMemo(() => {
    const term = String(search || "").trim().toLowerCase();
    const selectedClass = String(classLevel || "").trim().toLowerCase();

    return state.items.filter((item) => {
      const name = String(item.full_name || item.student_name || "").toLowerCase();
      const itemClass = String(item.class_level || item.grade_level || item.course_title || "").toLowerCase();
      const matchesSearch = !term || name.includes(term);
      const matchesClass = !selectedClass || itemClass === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [state.items, search, classLevel]);

  return (
    <div className="min-h-screen space-y-6 bg-[#FAF7F0] rounded-[2rem] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
      <section className="rounded-[2rem] border border-[#2D8A6A]/20 bg-[linear-gradient(135deg,rgba(13,59,46,0.96),rgba(13,92,72,0.95))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(6,63,50,0.45)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">Learner registry</h1>
        <p className="mt-3 text-sm leading-7 text-[#FAF7F0] sm:text-base">
          Review active student accounts, class placement, and parent links.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px]">
        <label className="space-y-2 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(6,63,50,0.12)]">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#245C4F]">Search student name</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by student name"
            className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
          />
        </label>
        <label className="space-y-2 rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(6,63,50,0.12)]">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#245C4F]">Class filter</span>
          <div className="relative">
            <select
              value={classLevel}
              onChange={(event) => setClassLevel(event.target.value)}
              onMouseDown={() => setClassOpen((current) => !current)}
              onFocus={() => setClassOpen(true)}
              onBlur={closeSelectState}
              className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/25 bg-[#FAF7F0] px-4 py-3 pr-11 text-sm text-[#063F32] outline-none transition focus:border-[#2D8A6A] focus:ring-4 focus:ring-[#C9A227]/20"
            >
              <option value="">All classes</option>
              {Array.from(ALLOWED_CLASS_LEVELS).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${classOpen ? "rotate-180" : "rotate-0"}`}
            />
          </div>
        </label>
      </div>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <OpenBookLoader title="Loading students" subtitle="Fetching the learner registry..." /> : null}
      <ShowMoreSection
        items={filteredItems}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <StudentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No student records available."
      />
      </div>
    </div>
  );
}
