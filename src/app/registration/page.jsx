"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";

const PARENT_RELATIONS = ["Father", "Mother", "Guardian", "Brother", "Sister", "Other"];

const initialForm = {
  studentName: "",
  parentName: "",
  parentRelation: "",
  parentEmail: "",
  phone: "",
  studentAge: "",
  classLevel: "",
  address: "",
  city: "",
  notes: "",
};

const initialErrors = {
  studentName: "",
  parentName: "",
  parentRelation: "",
  parentEmail: "",
  phone: "",
  studentAge: "",
  classLevel: "",
  form: "",
};

const container = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut", staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function RegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    const nextErrors = { ...initialErrors };
    if (!form.studentName.trim()) nextErrors.studentName = "Student name is required.";
    if (!form.parentName.trim()) nextErrors.parentName = "Parent name is required.";
    if (!form.parentRelation.trim()) nextErrors.parentRelation = "Parent relation is required.";
    if (!form.parentEmail.trim()) nextErrors.parentEmail = "Parent email is required.";
    else if (!isValidEmail(form.parentEmail.trim())) nextErrors.parentEmail = "Enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Phone is required.";
    if (!form.studentAge.trim()) nextErrors.studentAge = "Student age is required.";
    else if (Number.isNaN(Number(form.studentAge)) || Number(form.studentAge) <= 0) nextErrors.studentAge = "Enter a valid age.";
    if (!form.classLevel.trim()) nextErrors.classLevel = "Class level is required.";
    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate();
    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      setSuccessMessage("");
      return;
    }

    setPending(true);
    setErrors(initialErrors);
    setSuccessMessage("");

    try {
      const response = await fetch("/api/public/registration-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: form.studentName,
          parent_name: form.parentName,
          parent_relation: form.parentRelation,
          email: form.parentEmail,
          phone: form.phone,
          age: form.studentAge,
          class_level: form.classLevel,
          address: form.address,
          city: form.city,
          notes: form.notes,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit registration.");
      }

      setForm(initialForm);
      setSuccessMessage("Registration submitted successfully. Our coordinator will contact you soon.");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "Unable to submit registration.",
      }));
    } finally {
      setPending(false);
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-2xl border px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
      hasError
        ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100"
        : "border-slate-200 bg-slate-50 focus:border-sky-400 focus:ring-sky-100"
    }`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f7fb] text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.14),_transparent_30%),linear-gradient(180deg,_#f8fbff_0%,_#eef4ff_100%)]" />
      <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.div className="grid w-full items-stretch gap-8 lg:grid-cols-[1.02fr_0.98fr]" variants={container} initial="hidden" animate="show">
          <motion.section variants={item} className="flex flex-col justify-between rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">Student registration</span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Start your child&apos;s LMS registration in one simple form.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">Share the basic student and parent details. Our coordinator will review the request and contact you for the next steps.</p>
            </div>
            <div className="mt-10 rounded-3xl bg-slate-950 px-6 py-6 text-white shadow-lg">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-200">What happens next</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">New submissions go directly into the coordinator registration lead queue so the admissions process can begin right away.</p>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.22)] sm:p-8 lg:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Registration form</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Submit student details</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Complete the required fields and we&apos;ll route the request to the coordinator portal.</p>
            </div>

            {errors.form ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</div> : null}
            {successMessage ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}

            <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentName">Student Name</label>
                <input id="studentName" value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} className={inputClass(errors.studentName)} />
                {errors.studentName ? <p className="mt-2 text-sm text-rose-600">{errors.studentName}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentName">Parent Name</label>
                <input id="parentName" value={form.parentName} onChange={(event) => updateField("parentName", event.target.value)} className={inputClass(errors.parentName)} />
                {errors.parentName ? <p className="mt-2 text-sm text-rose-600">{errors.parentName}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentRelation">Parent Relation</label>
                <select id="parentRelation" value={form.parentRelation} onChange={(event) => updateField("parentRelation", event.target.value)} className={inputClass(errors.parentRelation)}>
                  <option value="">Select relation</option>
                  {PARENT_RELATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.parentRelation ? <p className="mt-2 text-sm text-rose-600">{errors.parentRelation}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentEmail">Parent Email</label>
                <input id="parentEmail" type="email" value={form.parentEmail} onChange={(event) => updateField("parentEmail", event.target.value)} className={inputClass(errors.parentEmail)} />
                {errors.parentEmail ? <p className="mt-2 text-sm text-rose-600">{errors.parentEmail}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="phone">Phone</label>
                <input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass(errors.phone)} />
                {errors.phone ? <p className="mt-2 text-sm text-rose-600">{errors.phone}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentAge">Student Age</label>
                <input id="studentAge" type="number" min="1" value={form.studentAge} onChange={(event) => updateField("studentAge", event.target.value)} className={inputClass(errors.studentAge)} />
                {errors.studentAge ? <p className="mt-2 text-sm text-rose-600">{errors.studentAge}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="classLevel">Class Level</label>
                <select id="classLevel" value={form.classLevel} onChange={(event) => updateField("classLevel", event.target.value)} className={inputClass(errors.classLevel)}>
                  <option value="">Select class level</option>
                  {[...ALLOWED_CLASS_LEVELS].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.classLevel ? <p className="mt-2 text-sm text-rose-600">{errors.classLevel}</p> : null}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="address">Address</label>
                <input id="address" value={form.address} onChange={(event) => updateField("address", event.target.value)} className={inputClass(false)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="city">City</label>
                <input id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass(false)} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="notes">Notes</label>
                <textarea id="notes" rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className={inputClass(false)} />
              </div>
              <motion.button type="submit" whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} disabled={pending} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2">
                {pending ? "Submitting..." : "Submit registration"}
              </motion.button>

              <div className="sm:col-span-2 text-center text-sm text-slate-600">
                Already registered?{" "}
                <a href="/login" className="font-semibold text-sky-700 transition hover:text-sky-800">
                  Sign in here
                </a>
              </div>
            </form>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}
