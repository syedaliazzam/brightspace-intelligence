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
    <div className="min-h-screen space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">New interested records of students</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          Review interested student submissions and generate registration links.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading interested students...</div> : null}
      <InterestedStudentsPanel items={state.items} />
    </div>
  );
}
