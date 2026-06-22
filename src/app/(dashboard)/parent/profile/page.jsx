"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";

export default function ParentProfilePage() {
  const [state, setState] = useState({ profile: null, children: [], error: "" });

  async function load() {
    const [profileResponse, childrenResponse] = await Promise.all([
      fetch("/api/parent/profile", { cache: "no-store" }),
      fetch("/api/parent/children", { cache: "no-store" }),
    ]);
    const profileData = await profileResponse.json();
    const childrenData = await childrenResponse.json();
    if (!profileResponse.ok || !childrenResponse.ok) throw new Error(profileData?.message || childrenData?.message || "Unable to load profile.");
    setState({ profile: profileData.profile || null, children: childrenData.children || [], error: "" });
  }

  useEffect(() => {
    load().catch((error) => setState((current) => ({ ...current, error: error.message })));
  }, []);

  const profile = state.profile || {};

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Profile</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Parent account details</h1>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Full name", profile.full_name],
            ["Email", profile.email],
            ["Phone", profile.phone],
            ["Relation", profile.relation],
            ["Status", profile.status],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-2 font-semibold text-slate-950">{value || "Not provided"}</p>
            </div>
          ))}
        </div>
      </section>
      <ChildSwitcher childrenList={state.children} value={state.children[0]?.id || ""} />
    </div>
  );
}
