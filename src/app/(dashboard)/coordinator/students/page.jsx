"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StudentTable from "@/components/coordinator/StudentTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";

export default function CoordinatorStudentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });
  const [search, setSearch] = useState("");
  const [classLevel, setClassLevel] = useState("");

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
    <div className="min-h-screen space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Learner registry</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Review active student accounts, class placement, and parent links.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_220px]">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Search student name</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by student name"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Class filter</span>
            <select
              value={classLevel}
              onChange={(event) => setClassLevel(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
            >
              <option value="">All classes</option>
              {Array.from(ALLOWED_CLASS_LEVELS).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading students...</div> : null}
      <ShowMoreSection
        items={filteredItems}
        initialCount={7}
        step={7}
        renderItems={(visibleItems) => <StudentTable items={visibleItems} onRefresh={load} />}
        emptyMessage="No student records available."
      />
    </div>
  );
}
