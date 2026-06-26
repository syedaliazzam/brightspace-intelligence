"use client";

import { useEffect, useState } from "react";

export default function TeacherProfilePage() {
  const [state, setState] = useState({ profile: null, error: "" });
  useEffect(() => {
    fetch("/api/teacher/profile", { cache: "no-store" }).then((response) => response.json().then((data) => {
      if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
      setState({ profile: data.profile || null, error: "" });
    })).catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);
  const profile = state.profile || {};
  const visibleFields = [["Full name", profile.full_name], ["Email", profile.email], ["Phone", profile.phone], ["Qualification", profile.qualification], ["Experience", profile.experience], ["Status", profile.status]].filter(([, value]) => value);
  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8"><p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Profile</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Teacher account details</h1></section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <section className="grid gap-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] sm:grid-cols-2">
        {visibleFields.map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 font-semibold text-slate-950">{value}</p></div>)}
      </section>
    </div>
  );
}
