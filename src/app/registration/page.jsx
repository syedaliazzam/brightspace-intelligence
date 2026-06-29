"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";

const PARENT_RELATIONS = ["Mother", "Father", "Guardian"];
const GENDER_OPTIONS = ["Boy", "Girl"];
const HEAR_ABOUT_OPTIONS = [
  "Friend / Family",
  "WhatsApp",
  "Facebook",
  "Educational Seminar",
  "School Referral",
  "Other",
];

const initialForm = {
  parentName: "",
  parentRelation: "",
  parentEmail: "",
  phone: "",
  cityCountry: "",
  studentName: "",
  gender: "",
  dateOfBirth: "",
  currentSchool: "",
  classLevel: "",
  otherClass: "",
  interestReason: "",
  heardAbout: "",
  heardAboutOther: "",
  notes: "",
};

const initialErrors = {
  parentName: "",
  parentRelation: "",
  parentEmail: "",
  phone: "",
  cityCountry: "",
  studentName: "",
  gender: "",
  dateOfBirth: "",
  classLevel: "",
  interestReason: "",
  heardAbout: "",
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

function calculateAgeFromDate(dateValue) {
  if (!dateValue) return null;

  const dateOfBirth = new Date(dateValue);
  if (Number.isNaN(dateOfBirth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : 0;
}

export default function RegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState(initialErrors);
  const [pending, setPending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [leadToken, setLeadToken] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams?.get("leadToken") || "";
    if (!token) return;

    setLeadToken(token);
    setTokenLoading(true);

    let active = true;

    async function loadLead() {
      try {
        const response = await fetch(`/api/public/interested-students/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data?.item) {
          return;
        }

        if (active) {
          setForm((current) => ({
            ...current,
            parentName: data.item.parent_name || current.parentName,
            parentEmail: data.item.email || current.parentEmail,
            phone: data.item.phone || current.phone,
            studentName: data.item.student_name || current.studentName,
          }));
        }
      } catch {
        // Keep manual registration working even if token prefill fails.
      } finally {
        if (active) setTokenLoading(false);
      }
    }

    void loadLead();

    return () => {
      active = false;
    };
  }, [searchParams]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    const nextErrors = { ...initialErrors };

    if (!form.parentName.trim()) nextErrors.parentName = "Parent name is required.";
    if (!form.parentRelation.trim()) nextErrors.parentRelation = "Relationship with child is required.";
    if (form.parentEmail.trim() && !isValidEmail(form.parentEmail.trim())) nextErrors.parentEmail = "Enter a valid email address.";
    if (!form.phone.trim()) nextErrors.phone = "Mobile / WhatsApp number is required.";
    if (!form.cityCountry.trim()) nextErrors.cityCountry = "City and country are required.";
    if (!form.studentName.trim()) nextErrors.studentName = "Child name is required.";
    if (!form.gender.trim()) nextErrors.gender = "Gender is required.";
    if (!form.dateOfBirth.trim()) nextErrors.dateOfBirth = "Date of birth is required.";
    if (!form.classLevel.trim()) nextErrors.classLevel = "Class applying for is required.";
    if (form.classLevel === "Other" && !form.otherClass.trim()) nextErrors.classLevel = "Please enter the class applying for.";
    if (!form.interestReason.trim()) nextErrors.interestReason = "Please share why you are interested in Ash-Shajarah.";
    if (!form.heardAbout.trim()) nextErrors.heardAbout = "Please tell us how you heard about Ash-Shajarah.";

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
          parent_name: form.parentName,
          parent_relation: form.parentRelation,
          email: form.parentEmail,
          phone: form.phone,
          city_country: form.cityCountry,
          student_name: form.studentName,
          gender: form.gender,
          date_of_birth: form.dateOfBirth,
          current_school: form.currentSchool,
          age: calculateAgeFromDate(form.dateOfBirth),
          class_level: form.classLevel === "Other" ? form.otherClass : form.classLevel,
          applying_for_other: form.classLevel === "Other" ? form.otherClass : "",
          interest_reason: form.interestReason,
          hear_about_source: form.heardAbout,
          hear_about_other: form.heardAbout === "Other" ? form.heardAboutOther : "",
          notes: form.notes,
          leadToken,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit registration.");
      }

      setForm(initialForm);
      setSuccessMessage(
        "Thank you for your interest in Ash-Shajarah - The Learning Hub. Our team will contact you regarding admissions, parent orientation sessions, and future updates, In Sha Allah. Learning • Character • Leadership"
      );
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
          <motion.section variants={item} className="flex flex-col justify-start rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-10 lg:p-12">
            <div className="max-w-xl">
              <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Student registration
              </span>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Start your child&apos;s registration with Ash-Shajarah - The Learning Hub.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
                Share the parent and child details below. Our admissions team will review the form and contact you with the next steps.
              </p>
            </div>
            <div className="mt-10 rounded-3xl bg-slate-950 px-6 py-6 text-white shadow-lg">
              <p className="text-sm uppercase tracking-[0.24em] text-sky-200">What happens next</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
                New submissions go directly into the coordinator registration record queue so the admissions process can begin right away.
              </p>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.22)] sm:p-8 lg:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Expression of interest / registration form</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Kindly share the following information</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Complete the form carefully so our team can guide you through admissions and orientation.</p>
            </div>

            {errors.form ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</div> : null}
            {successMessage ? <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div> : null}

            <form className="grid gap-5 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentName">Parent&apos;s Name</label>
                <input id="parentName" value={form.parentName} onChange={(event) => updateField("parentName", event.target.value)} className={inputClass(errors.parentName)} />
                {errors.parentName ? <p className="mt-2 text-sm text-rose-600">{errors.parentName}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentRelation">Relationship with Child</label>
                <select id="parentRelation" value={form.parentRelation} onChange={(event) => updateField("parentRelation", event.target.value)} className={inputClass(errors.parentRelation)}>
                  <option value="">Select relation</option>
                  {PARENT_RELATIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.parentRelation ? <p className="mt-2 text-sm text-rose-600">{errors.parentRelation}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="phone">Mobile / WhatsApp Number</label>
                <input id="phone" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} className={inputClass(errors.phone)} />
                {errors.phone ? <p className="mt-2 text-sm text-rose-600">{errors.phone}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="parentEmail">Email Address (Optional)</label>
                <input id="parentEmail" type="email" value={form.parentEmail} onChange={(event) => updateField("parentEmail", event.target.value)} className={inputClass(errors.parentEmail)} />
                {errors.parentEmail ? <p className="mt-2 text-sm text-rose-600">{errors.parentEmail}</p> : null}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="cityCountry">City &amp; Country</label>
                <input id="cityCountry" value={form.cityCountry} onChange={(event) => updateField("cityCountry", event.target.value)} className={inputClass(errors.cityCountry)} />
                {errors.cityCountry ? <p className="mt-2 text-sm text-rose-600">{errors.cityCountry}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="studentName">Child&apos;s Name</label>
                <input id="studentName" value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} className={inputClass(errors.studentName)} />
                {errors.studentName ? <p className="mt-2 text-sm text-rose-600">{errors.studentName}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender} onChange={(event) => updateField("gender", event.target.value)} className={inputClass(errors.gender)}>
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.gender ? <p className="mt-2 text-sm text-rose-600">{errors.gender}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="dateOfBirth">Child&apos;s Date of Birth</label>
                <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className={inputClass(errors.dateOfBirth)} />
                {errors.dateOfBirth ? <p className="mt-2 text-sm text-rose-600">{errors.dateOfBirth}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="currentSchool">Current School (if any)</label>
                <input id="currentSchool" value={form.currentSchool} onChange={(event) => updateField("currentSchool", event.target.value)} className={inputClass(false)} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="classLevel">Class Applying For</label>
                <select id="classLevel" value={form.classLevel} onChange={(event) => updateField("classLevel", event.target.value)} className={inputClass(errors.classLevel)}>
                  <option value="">Select class level</option>
                  {[...ALLOWED_CLASS_LEVELS].map((option) => <option key={option} value={option}>{option}</option>)}
                  <option value="Other">Other</option>
                </select>
                {errors.classLevel ? <p className="mt-2 text-sm text-rose-600">{errors.classLevel}</p> : null}
              </div>
              <div className="sm:col-span-2">
                {form.classLevel === "Other" ? (
                  <>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="otherClass">Other</label>
                    <input
                      id="otherClass"
                      value={form.otherClass}
                      onChange={(event) => updateField("otherClass", event.target.value)}
                      className={inputClass(false)}
                      placeholder="Enter class applying for"
                    />
                  </>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="interestReason">Why are you interested in Ash-Shajarah?</label>
                <textarea id="interestReason" rows={4} value={form.interestReason} onChange={(event) => updateField("interestReason", event.target.value)} className={inputClass(errors.interestReason)} />
                {errors.interestReason ? <p className="mt-2 text-sm text-rose-600">{errors.interestReason}</p> : null}
              </div>
              <div >
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="heardAbout">How did you hear about Ash-Shajarah?</label>
                <select id="heardAbout" value={form.heardAbout} onChange={(event) => updateField("heardAbout", event.target.value)} className={inputClass(errors.heardAbout)}>
                  <option value="">Select one option</option>
                  {HEAR_ABOUT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                {errors.heardAbout ? <p className="mt-2 text-sm text-rose-600">{errors.heardAbout}</p> : null}
              </div>
              <div>
                {form.heardAbout === "Other" ? (
                  <>
                    <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="heardAboutOther">Other</label>
                    <input
                      id="heardAboutOther"
                      value={form.heardAboutOther}
                      onChange={(event) => updateField("heardAboutOther", event.target.value)}
                      className={inputClass(false)}
                      placeholder="Please specify"
                    />
                  </>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="notes">Any questions, expectations, or comments you would like to share?</label>
                <textarea id="notes" rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className={inputClass(false)} />
              </div>
              <motion.button type="submit" whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} disabled={pending || tokenLoading} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2">
                {pending ? "Submitting..." : tokenLoading ? "Loading prefill..." : "Submit registration"}
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
