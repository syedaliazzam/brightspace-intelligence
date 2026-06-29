"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";
import LMSCalendar from "@/components/calendar/LMSCalendar";

function todayDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function ParentClassesPage() {
  const [state, setState] = useState({
    children: [],
    selectedChildId: "",
    error: "",
    filters: {
      date: todayDate(),
      range: "all",
      classLevel: "",
      subjectId: "",
      status: "",
    },
  });

  useEffect(() => {
    fetch("/api/parent/children", { cache: "no-store" })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) throw new Error(data?.message || "Unable to load children.");
        setState((current) => ({
          ...current,
          children: data.children || [],
          selectedChildId: "",
          error: "",
        }));
      })
      .catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Child lecture schedule and history</h1>
      </section>
      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => setState((current) => ({ ...current, selectedChildId: id }))}
      />
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {!state.selectedChildId ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-slate-600 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
          Please select a child first.
        </div>
      ) : (
        <LMSCalendar
          apiUrl="/api/parent/lectures"
          filters={state.filters}
          extraParams={{ childId: state.selectedChildId }}
          onDateSelect={(date) => setState((current) => ({ ...current, filters: { ...current.filters, date, range: "selected_date" } }))}
        />
      )}
    </div>
  );
}
