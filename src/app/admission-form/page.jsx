"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";

const PROGRAM_OPTIONS = [
  "Early Childhood Education (Parent Partnership Model)",
];

const STARTING_MONTH_OPTIONS = ["August", "September", "Other"];
const GENDER_OPTIONS = ["Boy", "Girl"];
const LANGUAGE_OPTIONS = ["English", "Urdu", "Bilingual"];
const YES_NO_OPTIONS = ["Yes", "No"];
const SUPPORT_OPTIONS = ["Mother", "Father", "Both", "Guardian"];
const CONTACT_OPTIONS = ["Father", "Mother"];
const DEVICE_OPTIONS = ["Laptop", "Desktop Computer", "External Monitor / Large Screen"];

const STEP_TITLES = [
  "Programme",
  "Student",
  "Profile",
  "Parents",
  "Readiness",
  "Declaration",
];

const initialForm = {
  programName: PROGRAM_OPTIONS[0],
  classLevel: "",
  preferredStartingMonth: "",
  preferredStartingMonthOther: "",
  studentName: "",
  studentNameUrdu: "",
  gender: "",
  dateOfBirth: "",
  country: "",
  city: "",
  nationality: "",
  religion: "",
  preferredLanguage: "",
  currentSchool: "",
  currentGrade: "",
  shiftReason: "",
  attendedOnlineClasses: "",
  childProfile: "",
  childStrengths: "",
  childSupportNeeds: "",
  childSpecialInterests: "",
  developmentalConcern: "",
  developmentalConcernDetails: "",
  medicalConditions: "",
  fatherNameEnglish: "",
  fatherNameUrdu: "",
  fatherCnic: "",
  fatherQualification: "",
  fatherOccupation: "",
  fatherMotherTongue: "",
  fatherContactHome: "",
  fatherContactOffice: "",
  fatherContactWhatsapp: "",
  fatherEmergencyContact: "",
  fatherEmail: "",
  fatherResidentialAddress: "",
  motherNameEnglish: "",
  motherNameUrdu: "",
  motherCnic: "",
  motherQualification: "",
  motherOccupation: "",
  motherMotherTongue: "",
  motherContactHome: "",
  motherContactOffice: "",
  motherContactWhatsapp: "",
  motherEmergencyContact: "",
  motherEmail: "",
  motherResidentialAddress: "",
  preferredContactPerson: "",
  supportPersonDuringLearning: "",
  deviceAvailable: "",
  whyJoinSchool: "",
  schoolExpectations: "",
  declarationAccepted: false,
  birthCertificateFile: null,
  parentCnicFile: null,
  childPhotographFile: null,
  previousSchoolReportFile: null,
  medicalReportFile: null,
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
  if (!dateValue) return "";

  const dateOfBirth = new Date(dateValue);
  if (Number.isNaN(dateOfBirth.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDifference = today.getMonth() - dateOfBirth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : "";
}

function getPrimaryParentName(form) {
  return form.preferredContactPerson === "Mother"
    ? form.motherNameEnglish || form.fatherNameEnglish
    : form.fatherNameEnglish || form.motherNameEnglish;
}

function getStepErrors(form) {
  const errors = {};

  if (!form.programName) errors.programName = "Programme is required.";
  if (!form.classLevel) errors.classLevel = "Applying class is required.";
  if (!form.preferredStartingMonth) errors.preferredStartingMonth = "Preferred starting month is required.";
  if (form.preferredStartingMonth === "Other" && !form.preferredStartingMonthOther.trim()) {
    errors.preferredStartingMonthOther = "Please specify the preferred starting month.";
  }

  if (!form.studentName.trim()) errors.studentName = "Student full name is required.";
  if (!form.gender) errors.gender = "Gender is required.";
  if (!form.dateOfBirth) errors.dateOfBirth = "Date of birth is required.";
  if (!form.country.trim()) errors.country = "Country is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.nationality.trim()) errors.nationality = "Nationality is required.";
  if (!form.religion.trim()) errors.religion = "Religion is required.";
  if (!form.preferredLanguage) errors.preferredLanguage = "Preferred language is required.";

  if (!form.whyJoinSchool.trim()) errors.whyJoinSchool = "Please share why you wish your child to join Ash-Shajarah.";
  if (!form.schoolExpectations.trim()) errors.schoolExpectations = "Please share your expectations from the school.";
  if (!form.supportPersonDuringLearning) errors.supportPersonDuringLearning = "Please select who will support the child.";
  if (!form.deviceAvailable) errors.deviceAvailable = "Device availability is required.";
  if (!form.attendedOnlineClasses) errors.attendedOnlineClasses = "Please select whether the child attended online classes.";
  if (!form.developmentalConcern) errors.developmentalConcern = "Please select whether there is any diagnosed concern.";
  if (form.developmentalConcern === "Yes" && !form.developmentalConcernDetails.trim()) {
    errors.developmentalConcernDetails = "Please share the diagnosed concern details.";
  }

  if (!form.fatherNameEnglish.trim() && !form.motherNameEnglish.trim()) {
    errors.parentNames = "At least one parent name is required.";
  }
  if (form.fatherEmail.trim() && !isValidEmail(form.fatherEmail.trim())) {
    errors.fatherEmail = "Enter a valid father email address.";
  }
  if (form.motherEmail.trim() && !isValidEmail(form.motherEmail.trim())) {
    errors.motherEmail = "Enter a valid mother email address.";
  }
  if (!form.preferredContactPerson) {
    errors.preferredContactPerson = "Preferred contact person is required.";
  }
  if (!getPrimaryParentName(form)) {
    errors.primaryParent = "Primary parent details are incomplete.";
  }
  if (
    form.preferredContactPerson === "Father" &&
    !(
      form.fatherContactWhatsapp.trim() ||
      form.fatherEmergencyContact.trim() ||
      form.fatherContactOffice.trim() ||
      form.fatherContactHome.trim()
    )
  ) {
    errors.fatherContactWhatsapp = "Father contact number is required for the preferred contact person.";
  }
  if (
    form.preferredContactPerson === "Mother" &&
    !(
      form.motherContactWhatsapp.trim() ||
      form.motherEmergencyContact.trim() ||
      form.motherContactOffice.trim() ||
      form.motherContactHome.trim()
    )
  ) {
    errors.motherContactWhatsapp = "Mother contact number is required for the preferred contact person.";
  }

  if (!form.birthCertificateFile) errors.birthCertificateFile = "Child B-Form / Birth Certificate is required.";
  if (!form.parentCnicFile) errors.parentCnicFile = "Parent CNIC is required.";
  if (!form.childPhotographFile) errors.childPhotographFile = "Recent child photograph is required.";
  if (!form.declarationAccepted) errors.declarationAccepted = "You must accept the declaration before submitting.";

  return errors;
}

function getErrorsForStep(form, step) {
  const allErrors = getStepErrors(form);
  const keysByStep = {
    0: ["programName", "classLevel", "preferredStartingMonth", "preferredStartingMonthOther"],
    1: ["studentName", "gender", "dateOfBirth", "country", "city", "nationality", "religion", "preferredLanguage"],
    2: ["attendedOnlineClasses", "developmentalConcern", "developmentalConcernDetails"],
    3: ["parentNames", "fatherEmail", "motherEmail", "preferredContactPerson", "primaryParent", "fatherContactWhatsapp", "motherContactWhatsapp"],
    4: ["supportPersonDuringLearning", "deviceAvailable", "birthCertificateFile", "parentCnicFile", "childPhotographFile"],
    5: ["whyJoinSchool", "schoolExpectations", "declarationAccepted"],
  };

  return (keysByStep[step] || []).reduce((accumulator, key) => {
    if (allErrors[key]) {
      accumulator[key] = allErrors[key];
    }
    return accumulator;
  }, {});
}

function stepHasErrors(step, errors) {
  const map = {
    0: ["programName", "classLevel", "preferredStartingMonth", "preferredStartingMonthOther"],
    1: ["studentName", "gender", "dateOfBirth", "country", "city", "nationality", "religion", "preferredLanguage"],
    2: ["attendedOnlineClasses", "developmentalConcern", "developmentalConcernDetails"],
    3: ["parentNames", "fatherEmail", "motherEmail", "preferredContactPerson", "primaryParent", "fatherContactWhatsapp", "motherContactWhatsapp"],
    4: ["supportPersonDuringLearning", "deviceAvailable", "birthCertificateFile", "parentCnicFile", "childPhotographFile"],
    5: ["whyJoinSchool", "schoolExpectations", "declarationAccepted"],
  };

  return (map[step] || []).some((key) => Boolean(errors[key]));
}

function FieldError({ error }) {
  return error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null;
}

function SelectField({ id, value, onChange, error, className = "", children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-full">
      <select
        id={id}
        value={value}
        onMouseDown={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={onChange}
        className={`${className} pr-12 appearance-none`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      />
      <FieldError error={error} />
    </div>
  );
}

function AdmissionFormContent() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);
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

        if (!response.ok || !data?.item || !active) {
          return;
        }

        setForm((current) => ({
          ...current,
          studentName: data.item.student_name || current.studentName,
          fatherNameEnglish: data.item.parent_name || current.fatherNameEnglish,
          fatherEmail: data.item.email || current.fatherEmail,
          fatherContactWhatsapp: data.item.phone || current.fatherContactWhatsapp,
          preferredContactPerson: current.preferredContactPerson || "Father",
        }));
      } catch {
        // Allow manual admission form submission even if prefill is unavailable.
      } finally {
        if (active) setTokenLoading(false);
      }
    }

    void loadLead();

    return () => {
      active = false;
    };
  }, [searchParams]);

  const age = useMemo(() => calculateAgeFromDate(form.dateOfBirth), [form.dateOfBirth]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  }

  function goNext() {
    const nextErrors = getErrorsForStep(form, step);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = getStepErrors(form);
    setErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      setSuccessMessage("");
      const firstErrorStep = STEP_TITLES.findIndex((_, index) => stepHasErrors(index, nextErrors));
      if (firstErrorStep >= 0) setStep(firstErrorStep);
      return;
    }

    setPending(true);
    setSuccessMessage("");

    try {
      const payload = new FormData();
      Object.entries({
        program_name: form.programName,
        class_level: form.classLevel,
        preferred_starting_month: form.preferredStartingMonth,
        preferred_starting_month_other: form.preferredStartingMonthOther,
        student_name: form.studentName,
        student_name_urdu: form.studentNameUrdu,
        gender: form.gender,
        date_of_birth: form.dateOfBirth,
        age: String(age || ""),
        country: form.country,
        city: form.city,
        nationality: form.nationality,
        religion: form.religion,
        preferred_language: form.preferredLanguage,
        current_school: form.currentSchool,
        current_grade: form.currentGrade,
        shift_reason: form.shiftReason,
        attended_online_classes: form.attendedOnlineClasses,
        child_profile: form.childProfile,
        child_strengths: form.childStrengths,
        child_support_needs: form.childSupportNeeds,
        child_special_interests: form.childSpecialInterests,
        developmental_concern: form.developmentalConcern,
        developmental_concern_details: form.developmentalConcernDetails,
        medical_conditions: form.medicalConditions,
        father_name_english: form.fatherNameEnglish,
        father_name_urdu: form.fatherNameUrdu,
        father_cnic: form.fatherCnic,
        father_qualification: form.fatherQualification,
        father_occupation: form.fatherOccupation,
        father_mother_tongue: form.fatherMotherTongue,
        father_contact_home: form.fatherContactHome,
        father_contact_office: form.fatherContactOffice,
        father_contact_whatsapp: form.fatherContactWhatsapp,
        father_emergency_contact: form.fatherEmergencyContact,
        father_email: form.fatherEmail,
        father_residential_address: form.fatherResidentialAddress,
        mother_name_english: form.motherNameEnglish,
        mother_name_urdu: form.motherNameUrdu,
        mother_cnic: form.motherCnic,
        mother_qualification: form.motherQualification,
        mother_occupation: form.motherOccupation,
        mother_mother_tongue: form.motherMotherTongue,
        mother_contact_home: form.motherContactHome,
        mother_contact_office: form.motherContactOffice,
        mother_contact_whatsapp: form.motherContactWhatsapp,
        mother_emergency_contact: form.motherEmergencyContact,
        mother_email: form.motherEmail,
        mother_residential_address: form.motherResidentialAddress,
        preferred_contact_person: form.preferredContactPerson,
        support_person_during_learning: form.supportPersonDuringLearning,
        device_available: form.deviceAvailable,
        why_join_school: form.whyJoinSchool,
        school_expectations: form.schoolExpectations,
        declaration_accepted: form.declarationAccepted ? "Yes" : "No",
        leadToken,
      }).forEach(([key, value]) => payload.append(key, value || ""));

      [
        ["birth_certificate_file", form.birthCertificateFile],
        ["parent_cnic_file", form.parentCnicFile],
        ["child_photograph_file", form.childPhotographFile],
        ["previous_school_report_file", form.previousSchoolReportFile],
        ["medical_report_file", form.medicalReportFile],
      ].forEach(([key, file]) => {
        if (file) payload.append(key, file);
      });

      const response = await fetch("/api/public/registration-leads", {
        method: "POST",
        body: payload,
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit admission form.");
      }

      setForm(initialForm);
      setErrors({});
      setStep(0);
      setSuccessMessage(
        "Admission form submitted successfully. Our admissions team will review the application and contact you with the next steps, In Sha Allah."
      );
    } catch (error) {
      setErrors((current) => ({
        ...current,
        form: error instanceof Error ? error.message : "Unable to submit admission form.",
      }));
    } finally {
      setPending(false);
    }
  }

  const inputClass = (hasError) =>
    `w-full rounded-[14px] border px-4 py-3 font-body text-[#063F32] outline-none transition placeholder:text-[#245C4F]/45 focus:ring-4 ${
      hasError
        ? "border-rose-300 bg-rose-50 focus:border-rose-400 focus:ring-rose-100"
        : "border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] shadow-[inset_0_1px_2px_rgba(13,59,46,0.04)] focus:border-[#2D8A6A] focus:bg-white focus:ring-[#2D8A6A]/10"
    }`;

  function renderProgrammeStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2 rounded-[1.1rem] border border-[rgba(201,162,39,0.26)] bg-[#FFF5D6]/80 px-4 py-4 text-sm leading-6 text-[#063F32]">
          For Academic Year 2026-2027, admissions are being offered in the Early Childhood programme only. Available classes are limited to the classes already active in the LMS.
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="programName">Programme</label>
          <SelectField id="programName" value={form.programName} onChange={(event) => updateField("programName", event.target.value)} error={errors.programName} className={inputClass(errors.programName)}>
            {PROGRAM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="classLevel">Applying for Class</label>
          <SelectField id="classLevel" value={form.classLevel} onChange={(event) => updateField("classLevel", event.target.value)} error={errors.classLevel} className={inputClass(errors.classLevel)}>
            <option value="">Select class</option>
            {[...ALLOWED_CLASS_LEVELS].map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredStartingMonth">Preferred Starting Month</label>
          <SelectField id="preferredStartingMonth" value={form.preferredStartingMonth} onChange={(event) => updateField("preferredStartingMonth", event.target.value)} error={errors.preferredStartingMonth} className={inputClass(errors.preferredStartingMonth)}>
            <option value="">Select month</option>
            {STARTING_MONTH_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        {form.preferredStartingMonth === "Other" ? (
          <div className="sm:col-span-2">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredStartingMonthOther">Other Starting Month</label>
            <input id="preferredStartingMonthOther" value={form.preferredStartingMonthOther} onChange={(event) => updateField("preferredStartingMonthOther", event.target.value)} className={inputClass(errors.preferredStartingMonthOther)} placeholder="Enter preferred month" />
            <FieldError error={errors.preferredStartingMonthOther} />
          </div>
        ) : null}
      </div>
    );
  }

  function renderStudentStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="studentName">Student Full Name (English)</label>
          <input id="studentName" value={form.studentName} onChange={(event) => updateField("studentName", event.target.value)} className={inputClass(errors.studentName)} />
          <FieldError error={errors.studentName} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="studentNameUrdu">Student Name (Urdu)</label>
          <input id="studentNameUrdu" value={form.studentNameUrdu} onChange={(event) => updateField("studentNameUrdu", event.target.value)} className={inputClass(false)} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="gender">Gender</label>
          <SelectField id="gender" value={form.gender} onChange={(event) => updateField("gender", event.target.value)} error={errors.gender} className={inputClass(errors.gender)}>
            <option value="">Select gender</option>
            {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="dateOfBirth">Date of Birth</label>
          <input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className={inputClass(errors.dateOfBirth)} />
          <FieldError error={errors.dateOfBirth} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="age">Age</label>
          <input id="age" value={age} readOnly className="w-full rounded-[14px] border border-[rgba(13,59,46,0.10)] bg-[#F1EADC] px-4 py-3 text-[#245C4F] outline-none" />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="country">Country</label>
          <input id="country" value={form.country} onChange={(event) => updateField("country", event.target.value)} className={inputClass(errors.country)} />
          <FieldError error={errors.country} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="city">City</label>
          <input id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} className={inputClass(errors.city)} />
          <FieldError error={errors.city} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="nationality">Nationality</label>
          <input id="nationality" value={form.nationality} onChange={(event) => updateField("nationality", event.target.value)} className={inputClass(errors.nationality)} />
          <FieldError error={errors.nationality} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="religion">Religion</label>
          <input id="religion" value={form.religion} onChange={(event) => updateField("religion", event.target.value)} className={inputClass(errors.religion)} />
          <FieldError error={errors.religion} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredLanguage">Preferred Language of Instruction</label>
          <SelectField id="preferredLanguage" value={form.preferredLanguage} onChange={(event) => updateField("preferredLanguage", event.target.value)} error={errors.preferredLanguage} className={inputClass(errors.preferredLanguage)}>
            <option value="">Select language</option>
            {LANGUAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="currentSchool">Current School (if applicable)</label>
          <input id="currentSchool" value={form.currentSchool} onChange={(event) => updateField("currentSchool", event.target.value)} className={inputClass(false)} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="currentGrade">Current Grade</label>
          <input id="currentGrade" value={form.currentGrade} onChange={(event) => updateField("currentGrade", event.target.value)} className={inputClass(false)} />
        </div>
      </div>
    );
  }

  function renderProfileStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="shiftReason">Reason for shifting from physical to online schooling</label>
          <textarea id="shiftReason" rows={3} value={form.shiftReason} onChange={(event) => updateField("shiftReason", event.target.value)} className={inputClass(false)} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="attendedOnlineClasses">Has the child previously attended online classes?</label>
          <SelectField id="attendedOnlineClasses" value={form.attendedOnlineClasses} onChange={(event) => updateField("attendedOnlineClasses", event.target.value)} error={errors.attendedOnlineClasses} className={inputClass(errors.attendedOnlineClasses)}>
            <option value="">Select option</option>
            {YES_NO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="developmentalConcern">Any diagnosed learning difficulty or developmental concern?</label>
          <SelectField id="developmentalConcern" value={form.developmentalConcern} onChange={(event) => updateField("developmentalConcern", event.target.value)} error={errors.developmentalConcern} className={inputClass(errors.developmentalConcern)}>
            <option value="">Select option</option>
            {YES_NO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        {form.developmentalConcern === "Yes" ? (
          <div className="sm:col-span-2">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="developmentalConcernDetails">If yes, please share details</label>
            <textarea id="developmentalConcernDetails" rows={3} value={form.developmentalConcernDetails} onChange={(event) => updateField("developmentalConcernDetails", event.target.value)} className={inputClass(errors.developmentalConcernDetails)} />
            <FieldError error={errors.developmentalConcernDetails} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childProfile">Please describe your child briefly</label>
          <textarea id="childProfile" rows={3} value={form.childProfile} onChange={(event) => updateField("childProfile", event.target.value)} className={inputClass(false)} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childStrengths">Strengths</label>
          <textarea id="childStrengths" rows={3} value={form.childStrengths} onChange={(event) => updateField("childStrengths", event.target.value)} className={inputClass(false)} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childSupportNeeds">Areas needing support</label>
          <textarea id="childSupportNeeds" rows={3} value={form.childSupportNeeds} onChange={(event) => updateField("childSupportNeeds", event.target.value)} className={inputClass(false)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childSpecialInterests">Special interests</label>
          <textarea id="childSpecialInterests" rows={3} value={form.childSpecialInterests} onChange={(event) => updateField("childSpecialInterests", event.target.value)} className={inputClass(false)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="medicalConditions">Medical conditions (if any)</label>
          <textarea id="medicalConditions" rows={3} value={form.medicalConditions} onChange={(event) => updateField("medicalConditions", event.target.value)} className={inputClass(false)} />
        </div>
      </div>
    );
  }

  function renderParentColumn(prefix, title) {
    const nameEnglishKey = `${prefix}NameEnglish`;
    const nameUrduKey = `${prefix}NameUrdu`;
    const cnicKey = `${prefix}Cnic`;
    const qualificationKey = `${prefix}Qualification`;
    const occupationKey = `${prefix}Occupation`;
    const motherTongueKey = `${prefix}MotherTongue`;
    const homeKey = `${prefix}ContactHome`;
    const officeKey = `${prefix}ContactOffice`;
    const whatsappKey = `${prefix}ContactWhatsapp`;
    const emergencyKey = `${prefix}EmergencyContact`;
    const emailKey = `${prefix}Email`;
    const addressKey = `${prefix}ResidentialAddress`;

    return (
      <div className="rounded-[1.5rem] border border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] p-4 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
        <h3 className="font-display text-lg font-semibold text-[#063F32]">{title}</h3>
        <div className="mt-4 grid gap-4">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{title} Name (Block Letters)</label>
            <input value={form[nameEnglishKey]} onChange={(event) => updateField(nameEnglishKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">{title} Name (Urdu)</label>
            <input value={form[nameUrduKey]} onChange={(event) => updateField(nameUrduKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">CNIC Number</label>
            <input value={form[cnicKey]} onChange={(event) => updateField(cnicKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Qualification</label>
            <input value={form[qualificationKey]} onChange={(event) => updateField(qualificationKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Occupation</label>
            <input value={form[occupationKey]} onChange={(event) => updateField(occupationKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Mother Tongue</label>
            <input value={form[motherTongueKey]} onChange={(event) => updateField(motherTongueKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Contact No. (Home)</label>
            <input value={form[homeKey]} onChange={(event) => updateField(homeKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Contact No. (Office)</label>
            <input value={form[officeKey]} onChange={(event) => updateField(officeKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Contact No. (WhatsApp)</label>
            <input value={form[whatsappKey]} onChange={(event) => updateField(whatsappKey, event.target.value)} className={inputClass(errors[whatsappKey])} />
            <FieldError error={errors[whatsappKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Emergency Contact No.</label>
            <input value={form[emergencyKey]} onChange={(event) => updateField(emergencyKey, event.target.value)} className={inputClass(false)} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Email ID</label>
            <input type="email" value={form[emailKey]} onChange={(event) => updateField(emailKey, event.target.value)} className={inputClass(errors[emailKey])} />
            <FieldError error={errors[emailKey]} />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]">Residential Address</label>
            <textarea rows={3} value={form[addressKey]} onChange={(event) => updateField(addressKey, event.target.value)} className={inputClass(false)} />
          </div>
        </div>
      </div>
    );
  }

  function renderParentsStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        {errors.parentNames ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.parentNames}</div> : null}
        {errors.primaryParent ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.primaryParent}</div> : null}
        <div className="grid gap-5 lg:grid-cols-2">
          {renderParentColumn("father", "Father")}
          {renderParentColumn("mother", "Mother")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="preferredContactPerson">Preferred Contact Person</label>
            <SelectField id="preferredContactPerson" value={form.preferredContactPerson} onChange={(event) => updateField("preferredContactPerson", event.target.value)} error={errors.preferredContactPerson} className={inputClass(errors.preferredContactPerson)}>
              <option value="">Select contact person</option>
              {CONTACT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="supportPersonDuringLearning">Who will support the child during learning?</label>
            <SelectField id="supportPersonDuringLearning" value={form.supportPersonDuringLearning} onChange={(event) => updateField("supportPersonDuringLearning", event.target.value)} error={errors.supportPersonDuringLearning} className={inputClass(errors.supportPersonDuringLearning)}>
              <option value="">Select support person</option>
              {SUPPORT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>
          </div>
        </div>
      </div>
    );
  }

  function renderReadinessStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:grid-cols-2 sm:p-6">
        <div className="sm:col-span-2 rounded-[1.1rem] border border-[rgba(201,162,39,0.26)] bg-[#FFF5D6]/80 px-4 py-4 text-sm leading-6 text-[#063F32]">
          Regular class attendance through smartphones or tablets is not permitted. Please arrange a laptop, desktop computer, or an adequately sized screen for the child.
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="deviceAvailable">Device available for online classes</label>
          <SelectField id="deviceAvailable" value={form.deviceAvailable} onChange={(event) => updateField("deviceAvailable", event.target.value)} error={errors.deviceAvailable} className={inputClass(errors.deviceAvailable)}>
            <option value="">Select device</option>
            {DEVICE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="birthCertificateFile">Child B-Form / Birth Certificate</label>
          <input id="birthCertificateFile" type="file" accept="image/*,.pdf" onChange={(event) => updateField("birthCertificateFile", event.target.files?.[0] || null)} className={inputClass(errors.birthCertificateFile)} />
          <FieldError error={errors.birthCertificateFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="parentCnicFile">Parent CNIC</label>
          <input id="parentCnicFile" type="file" accept="image/*,.pdf" onChange={(event) => updateField("parentCnicFile", event.target.files?.[0] || null)} className={inputClass(errors.parentCnicFile)} />
          <FieldError error={errors.parentCnicFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="childPhotographFile">Recent Child Photograph</label>
          <input id="childPhotographFile" type="file" accept="image/*,.pdf" onChange={(event) => updateField("childPhotographFile", event.target.files?.[0] || null)} className={inputClass(errors.childPhotographFile)} />
          <FieldError error={errors.childPhotographFile} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="previousSchoolReportFile">Previous School Report (if applicable)</label>
          <input id="previousSchoolReportFile" type="file" accept="image/*,.pdf" onChange={(event) => updateField("previousSchoolReportFile", event.target.files?.[0] || null)} className={inputClass(false)} />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="medicalReportFile">Medical Report (if applicable)</label>
          <input id="medicalReportFile" type="file" accept="image/*,.pdf" onChange={(event) => updateField("medicalReportFile", event.target.files?.[0] || null)} className={inputClass(false)} />
        </div>
      </div>
    );
  }

  function renderDeclarationStep() {
    return (
      <div className="grid gap-5 rounded-[1.35rem] border border-[rgba(13,59,46,0.08)] bg-white/95 p-4 shadow-[0_12px_28px_rgba(13,59,46,0.05)] sm:p-6">
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="whyJoinSchool">Why do you wish your child to join Ash-Shajarah?</label>
          <textarea id="whyJoinSchool" rows={4} value={form.whyJoinSchool} onChange={(event) => updateField("whyJoinSchool", event.target.value)} className={inputClass(errors.whyJoinSchool)} />
          <FieldError error={errors.whyJoinSchool} />
        </div>
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#0D5C48]" htmlFor="schoolExpectations">What are your expectations from this school?</label>
          <textarea id="schoolExpectations" rows={4} value={form.schoolExpectations} onChange={(event) => updateField("schoolExpectations", event.target.value)} className={inputClass(errors.schoolExpectations)} />
          <FieldError error={errors.schoolExpectations} />
        </div>
        <div className="rounded-[1.5rem] border border-[rgba(201,162,39,0.22)] bg-[#FFF5D6]/80 p-5 text-sm leading-7 text-[#245C4F] shadow-[0_10px_22px_rgba(201,162,39,0.08)]">
          <p className="font-display font-semibold text-[#063F32]">Declaration & Parent Commitment</p>
          <p className="mt-3">I/We declare that all information provided in this application is true and correct to the best of our knowledge.</p>
          <p className="mt-3">I/We understand that Ash-Shajarah follows a Parent Partnership and Guided Home Learning Model where active parental involvement is essential for meaningful learning outcomes.</p>
          <p className="mt-3">I/We understand that live online interaction will be age-appropriate and limited, and that parents are expected to support guided off-screen activities, orientation sessions, parenting workshops, academic training programmes, school schedules, assessment procedures, and healthy device practices.</p>
        </div>
        <label className="flex items-start gap-3 rounded-2xl border border-[rgba(13,59,46,0.12)] bg-[#FCFAF5] px-4 py-4 text-sm text-[#245C4F] shadow-[0_8px_20px_rgba(13,59,46,0.04)]">
          <input type="checkbox" checked={form.declarationAccepted} onChange={(event) => updateField("declarationAccepted", event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2D8A6A] focus:ring-[#2D8A6A]" />
          <span>I/We accept the declaration and commit to working collaboratively with Ash-Shajarah as active partners in our child&apos;s learning, character development, and overall growth.</span>
        </label>
        <FieldError error={errors.declarationAccepted} />
      </div>
    );
  }

  const stepContent = [
    renderProgrammeStep(),
    renderStudentStep(),
    renderProfileStep(),
    renderParentsStep(),
    renderReadinessStep(),
    renderDeclarationStep(),
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#FAF7F0] text-[#063F32]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,138,106,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(201,162,39,0.12),_transparent_30%),radial-gradient(circle_at_center,_rgba(101,184,145,0.08),_transparent_42%)]" />
      <div className="absolute left-[-6rem] top-24 h-56 w-56 rounded-full bg-[#2D8A6A]/10 blur-3xl" />
      <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-[#C9A227]/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <motion.div className="grid w-full items-stretch gap-8 lg:grid-cols-[0.8fr_1.2fr]" variants={container} initial="hidden" animate="show">
          <motion.section variants={item} className="flex w-full flex-col justify-start rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-[linear-gradient(180deg,_rgba(252,250,245,0.98)_0%,_rgba(245,240,232,0.96)_100%)] p-6 shadow-[0_24px_60px_rgba(13,59,46,0.12)] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="rounded-[1.6rem] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-6 text-[#FAF7F0] shadow-[0_14px_32px_rgba(6,63,50,0.2)]">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F7EFCF]">
                Admission form
              </span>
              <h1 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Apply for your child&apos;s admission to Ash-Shajarah Learning Hub.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-[#F3EEDB]/85 sm:text-[1.02rem]">
                Complete the admission form step by step. Our admissions team will review the application and guide you through the next stage.
              </p>
            </div>

            <div className="mt-7 grid gap-3 rounded-[1.6rem] border border-[rgba(13,59,46,0.08)] bg-white/70 p-3 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
              {STEP_TITLES.map((label, index) => (
                <div key={label} className={`flex items-center gap-3 rounded-[1.15rem] border px-3 py-3 text-sm shadow-[0_8px_20px_rgba(13,59,46,0.04)] ${index === step ? "border-[#C9A227]/30 bg-[#FFF5D6]/80 text-[#063F32]" : index < step ? "border-[#2D8A6A]/20 bg-[#F4F0E7] text-[#063F32]" : "border-[rgba(13,59,46,0.10)] bg-white/90 text-[#245C4F]"}`}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${index === step ? "bg-gradient-to-br from-[#C9A227] to-[#E4C766] text-[#063F32]" : index < step ? "bg-[#2D8A6A] text-[#FAF7F0]" : "bg-[#FAF7F0] text-[#245C4F]"}`}>
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{label}</p>
                    <p className="text-xs uppercase tracking-[0.18em] opacity-75">
                      {index === step ? "Current step" : index < step ? "Completed" : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-[1.5rem] border border-[rgba(13,59,46,0.08)] bg-[linear-gradient(135deg,_#063F32_0%,_#0D5C48_45%,_#236B51_100%)] p-6 text-[#FAF7F0] px-5 py-5 shadow-[0_10px_24px_rgba(13,59,46,0.04)]">
              <p className="text-sm uppercase tracking-[0.24em] text-white">Healthy digital learning</p>
              <p className="mt-3 max-w-md text-sm leading-6">
                Ash-Shajarah follows a parent partnership model with age-appropriate online sessions, guided home activities, and a strong focus on healthy device use.
              </p>
            </div>
          </motion.section>

          <motion.section variants={item} className="rounded-[2.2rem] border border-[rgba(13,59,46,0.12)] bg-[linear-gradient(180deg,_#FCFAF5_0%,_#F7F1E7_100%)] p-6 shadow-[0_24px_60px_rgba(13,59,46,0.1)] sm:p-8 lg:p-10">
            <div className="mb-8 rounded-[1.4rem] border border-[rgba(13,59,46,0.08)] bg-white/90 p-5 shadow-[0_10px_24px_rgba(13,59,46,0.05)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0D5C48]">Online school admission form</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#063F32]">Step {step + 1}: {STEP_TITLES[step]}</h2>
              <p className="mt-2 text-sm leading-6 text-[#245C4F]/80">Please complete this section carefully. Fields required by the admissions team should not be left blank.</p>
            </div>

            {errors.form ? <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errors.form}</div> : null}
            {successMessage ? <div className="mb-5 rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-3 text-sm text-[#0D5C48]">{successMessage}</div> : null}

            <form className="grid gap-6" onSubmit={handleSubmit}>
              {stepContent[step]}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(13,59,46,0.08)] pt-6">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0 || pending}
                  className="rounded-full border border-[rgba(13,59,46,0.12)] bg-white px-4 py-3 text-sm font-semibold text-[#0D5C48] shadow-[0_8px_20px_rgba(13,59,46,0.04)] transition hover:bg-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Back
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-[#FAF7F0] px-3 py-2 text-sm text-[#245C4F]">
                    {tokenLoading ? "Loading lead details..." : `Step ${step + 1} of ${STEP_TITLES.length}`}
                  </span>
                  {step < STEP_TITLES.length - 1 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={pending || tokenLoading}
                      className="rounded-full bg-[#236B51] px-4 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#184A38] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Next step
                    </button>
                  ) : (
                    <motion.button
                      type="submit"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.99 }}
                      disabled={pending || tokenLoading}
                      className="rounded-full bg-[#236B51] px-5 py-3 text-sm font-semibold text-[#FAF7F0] shadow-[0_12px_28px_rgba(45,138,106,0.25)] transition hover:bg-[#184A38] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {pending ? "Submitting..." : tokenLoading ? "Loading prefill..." : "Submit admission form"}
                    </motion.button>
                  )}
                </div>
              </div>
            </form>
          </motion.section>
        </motion.div>
      </div>
    </main>
  );
}

export default function AdmissionFormPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#FAF7F0]" />}>
      <AdmissionFormContent />
    </Suspense>
  );
}
