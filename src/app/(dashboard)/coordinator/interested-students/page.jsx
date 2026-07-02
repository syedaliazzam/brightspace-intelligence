"use client";

import { useEffect, useState } from "react";
import InterestedStudentsPanel from "@/components/coordinator/InterestedStudentsPanel";

export default function CoordinatorInterestedStudentsPage() {
  const [state, setState] = useState({ items: [], loading: true, error: "" });

  useEffect(() => {
    let active = true;

    async function load() {
      setState((current) => ({ ...current, loading: true }));
      const response = await fetch("/api/coordinator/interested-students", { cache: "no-store" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load interested students.");
      }

      if (active) {
        setState({ items: data.items || [], loading: false, error: "" });
      }
    }

    load().catch((error) => {
      if (active) {
        setState({ items: [], loading: false, error: error.message });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen space-y-6 rounded-[2rem] bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#FAF7F0] sm:text-4xl">New interested records of students</h1>
        <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
          Review interested student submissions and generate registration links.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl border border-[#2D8A6A]/15 bg-white/90 p-5 text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.18)]">Loading interested students...</div> : null}
      <InterestedStudentsPanel items={state.items} />
      </div>
    </div>
  );
}
