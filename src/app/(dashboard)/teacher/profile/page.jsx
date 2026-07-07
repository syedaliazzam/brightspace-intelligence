"use client";

import { useEffect, useState } from "react";

export default function TeacherProfilePage() {
  const [state, setState] = useState({ profile: null, error: "" });

  useEffect(() => {
    fetch("/api/teacher/profile", { cache: "no-store" })
      .then((response) =>
        response.json().then((data) => {
          if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
          setState({ profile: data.profile || null, error: "" });
        })
      )
      .catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  const profile = state.profile || {};
  const visibleFields = [
    ["Full name", profile.full_name],
    ["Email", profile.email],
    ["Phone", profile.phone],
    ["Qualification", profile.qualification],
    ["Experience", profile.experience],
    ["Status", profile.status],
  ].filter(([, value]) => value);

  return (
    <div className="min-h-screen border-0 space-y-6 bg-[#FAF7F0]">
      <div className="pointer-events-none border-0 absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative rounded-[2rem] border-0 mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,198,102,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(101,184,145,0.14),transparent_30%)]" />
          <div className="relative max-w-6xl">
            <p className="inline-flex rounded-full border border-[#FFF5D6]/30 bg-[#FFF5D6]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">Profile</p>
            <h1 className="mb-3 mt-4 text-2xl font-bold text-[#FAF7F0] sm:text-4xl lg:text-4xl font-display">Teacher account details</h1>
          </div>
        </section>
        {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
        <section className="grid gap-6 rounded-[2rem] sm:grid-cols-2">
          {visibleFields.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#2D8A6A]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,247,240,0.98)_100%)] p-4 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)] backdrop-blur-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</p>
              <p className="mt-2 font-semibold text-[#063F32]">{value}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
