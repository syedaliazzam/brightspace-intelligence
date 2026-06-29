"use client";

import { useEffect, useState } from "react";

function DetailRow({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{value || "Not provided"}</p>
    </div>
  );
}

export default function StudentProfilePage() {
  const [state, setState] = useState({ profile: null, error: "", loading: true });

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/student/profile", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load profile.");
      setState({ profile: data.profile || null, error: "", loading: false });
    }

    load().catch((error) => setState({ profile: null, error: error.message, loading: false }));
  }, []);

  const profile = state.profile || {};

  return (
    <div className="space-y-6 min-h-screen">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Student profile details</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
          View your account, enrollment, and admission details in one place.
        </p>
      </section>

      {state.error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{state.error}</div> : null}
      {state.loading ? <div className="rounded-2xl bg-white p-5 text-sm text-slate-500">Loading profile...</div> : null}

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Full name" value={profile.full_name} />
          <DetailRow label="Username" value={profile.username} />
          <DetailRow label="Email" value={profile.email} />
          <DetailRow label="Phone" value={profile.phone} />
          <DetailRow label="Admission number" value={profile.admission_no} />
          <DetailRow label="Age" value={profile.age ? String(profile.age) : ""} />
          <DetailRow label="Class" value={profile.grade_level} />
          <DetailRow label="Course" value={profile.course_title} />
          <DetailRow label="Status" value={profile.profile_status || profile.user_status} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <h2 className="text-xl font-semibold text-slate-950">Admission snapshot</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Father name" value={profile.father_name} />
          <DetailRow label="Father phone" value={profile.father_phone} />
          <DetailRow label="Father email" value={profile.father_email} />
          <DetailRow label="Lead student name" value={profile.lead_student_name} />
          <DetailRow label="Parent relation" value={profile.lead_parent_relation} />
          <DetailRow label="Programme" value={profile.program_name} />
          <DetailRow label="Current school" value={profile.current_school} />
          <DetailRow label="Current grade" value={profile.current_grade} />
          <DetailRow label="Gender" value={profile.gender} />
          <DetailRow label="Date of birth" value={profile.date_of_birth} />
          <DetailRow label="City / country" value={profile.city_country} />
          <DetailRow label="Nationality" value={profile.nationality} />
          <DetailRow label="Religion" value={profile.religion} />
          <DetailRow label="Preferred language" value={profile.preferred_language} />
          <DetailRow label="Support person" value={profile.support_person_during_learning} />
          <DetailRow label="Device available" value={profile.device_available} />
          <DetailRow label="School expectations" value={profile.school_expectations} />
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)]">
        <h2 className="text-xl font-semibold text-slate-950">Child profile</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DetailRow label="Profile" value={profile.child_profile} />
          <DetailRow label="Strengths" value={profile.child_strengths} />
          <DetailRow label="Support needs" value={profile.child_support_needs} />
          <DetailRow label="Special interests" value={profile.child_special_interests} />
          <DetailRow label="Development concern" value={profile.developmental_concern ? "Yes" : "No"} />
          <DetailRow label="Concern details" value={profile.developmental_concern_details} />
          <DetailRow label="Medical conditions" value={profile.medical_conditions} />
        </div>
      </section>
    </div>
  );
}
