"use client";

import { useEffect, useState } from "react";
import ChildSwitcher from "@/components/parent/ChildSwitcher";

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[#063F32]">{value || "Not provided"}</p>
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
    <div className="relative rounded-[2rem] min-h-screen overflow-hidden bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 overflow-hidden rounded-[2rem] px-4 py-4 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(13,59,46,0.22)] sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Parent profile</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[#063F32] sm:text-4xl">Parent profile details</h1>
      </section>
      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
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
        <div className="rounded-[1.75rem] border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] p-8 text-center text-sm text-[#245C4F] shadow-[0_18px_60px_-36px_rgba(13,59,46,0.16)]">
          Please select a child first.
        </div>
      ) : (
        <section className="rounded-[1.75rem] border border-[#2D8A6A]/15 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
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
    </div>
  );
}
