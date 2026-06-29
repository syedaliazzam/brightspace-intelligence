"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value || "Not provided"}</p>
    </div>
  );
}

export default function ParentProfilePage() {
  const [state, setState] = useState({ profile: null, children: [], selectedChildId: "", error: "" });

  async function load() {
    const [profileResponse, childrenResponse] = await Promise.all([
      fetch("/api/parent/profile", { cache: "no-store" }),
      fetch("/api/parent/children", { cache: "no-store" }),
    ]);
    const profileData = await profileResponse.json();
    const childrenData = await childrenResponse.json();
    if (!profileResponse.ok || !childrenResponse.ok) throw new Error(profileData?.message || childrenData?.message || "Unable to load profile.");
    setState({
      profile: profileData.profile || null,
      children: childrenData.children || [],
      selectedChildId: "",
      error: "",
    });
  }

  useEffect(() => {
    async function initialize() {
      try {
        await load();
      } catch (error) {
        setState((current) => ({ ...current, error: error.message }));
      }
    }

    initialize();
  }, []);

  const profile = state.profile || {};
  const selectedChild = state.children.find((child) => String(child.id) === String(state.selectedChildId)) || null;

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Parent profile details</h1>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Full name" value={profile.full_name} />
          <DetailRow label="Email" value={profile.email} />
          <DetailRow label="Phone" value={profile.phone} />
          <DetailRow label="Relation" value={profile.relation} />
          <DetailRow label="Status" value={profile.status} />
          <DetailRow label="Children" value={profile.child_names} />
        </div>
      </section>
      <ChildSwitcher
        childrenList={state.children}
        value={state.selectedChildId}
        onChange={(id) => setState((current) => ({ ...current, selectedChildId: id }))}
      />
      {!selectedChild ? (
        <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/85 p-8 text-center text-sm text-slate-600 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.18)]">
          Please select a child first.
        </div>
      ) : (
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Full name" value={selectedChild.full_name} />
            <DetailRow label="Username" value={selectedChild.username} />
            <DetailRow label="Email" value={selectedChild.email} />
            <DetailRow label="Phone" value={selectedChild.phone} />
            <DetailRow label="Class" value={selectedChild.grade_level} />
            <DetailRow label="Status" value={selectedChild.status} />
            <DetailRow label="Age" value={selectedChild.age ? String(selectedChild.age) : ""} />
            <DetailRow label="Course" value={selectedChild.course_title} />
            <DetailRow label="Lead relation" value={selectedChild.parent_relation} />
            <DetailRow label="Programme" value={selectedChild.program_name} />
            <DetailRow label="Current school" value={selectedChild.current_school} />
            <DetailRow label="Gender" value={selectedChild.gender} />
            <DetailRow label="Date of birth" value={selectedChild.date_of_birth} />
            <DetailRow label="City / country" value={selectedChild.city_country} />
            <DetailRow label="Nationality" value={selectedChild.nationality} />
            <DetailRow label="Religion" value={selectedChild.religion} />
            <DetailRow label="Preferred language" value={selectedChild.preferred_language} />
            <DetailRow label="Support person" value={selectedChild.support_person_during_learning} />
            <DetailRow label="Device available" value={selectedChild.device_available} />
          </div>
        </section>
      )}
    </div>
  );
}
