"use client";
/* eslint-disable react-hooks/set-state-in-effect */

// ECCE Assessments Component
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ChevronDown, Download, Edit3, RefreshCw, X } from "lucide-react";
import { ECCE_RATINGS, ECCE_SECTIONS, ECCE_SUBJECTS, ECCE_TERMS } from "@/lib/ecceAssessmentTemplate";
import { downloadAssessmentPdf } from "@/lib/ecceAssessmentPdf";

const inputClass = "w-full rounded-[1rem] border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#C79A3B] focus:ring-4 focus:ring-[#C79A3B]/15";
const buttonClass = "rounded-full bg-[#0F4C3A] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(15,76,58,.8)] transition hover:bg-[#0B3D30] disabled:cursor-not-allowed disabled:opacity-60";
const ghostButtonClass = "rounded-full border border-[#2D8A6A]/20 bg-white px-5 py-3 text-sm font-bold text-[#0F4C3A] transition hover:border-[#C79A3B]/60";

function ThemedSelect({ className = "", children, ...props }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className={`${inputClass} appearance-none pr-9 cursor-pointer bg-white text-[#063F32] ${props.className || ""}`}
        onFocus={(event) => {
          setOpen(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setOpen(false);
          props.onBlur?.(event);
        }}
      >
        {children}
      </select>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
      />
    </div>
  );
}

function currentYear() {
  return String(new Date().getFullYear());
}

function extractStoragePath(value) {
  if (!value || typeof value !== "string") return "";
  let text = value.trim();
  if (!text || text.startsWith("data:") || text.startsWith("blob:")) return "";

  if (text.includes("/api/file-preview")) {
    try {
      const url = new URL(text, typeof window !== "undefined" ? window.location.origin : "http://localhost");
      const pathParam = url.searchParams.get("path");
      if (pathParam) text = pathParam;
    } catch { }
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const pathname = decodeURIComponent(url.pathname);
      const match = pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/(.+)$/);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    } catch {
      return "";
    }
  }

  return text.replace(/^\/+/, "");
}

function buildPreviewUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text) || text.startsWith("blob:") || text.startsWith("data:")) return text;
  return `/api/file-preview?path=${encodeURIComponent(text)}`;
}

function dateInputValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, 10);
}

function labelForCriterion(criterion) {
  return criterion.label_ur || criterion.label_en || "-";
}

const LISTENING_LABELS = [
  "سنتے وقت بولنے والے سے آنکھیں ملاتا ہے۔",
  "پوری توجہ سے سنتا ہے۔",
  "ایک ہی وقت میں دو یا دو سے زائد ہدایت سنتا ہے اور عمل کرتا ہے",
  "سادہ جملوں کو سننا اور دھرانا",
  "نظم کی طرز سن کر نظم کے الفاظ دھراتا ہے",
  "کہانیوں کو توجہ سے سننا اور سوالات کے جواب دینا۔",
  "کہانی سن کر ہم جماعت /گھر والوں کو اپنے الفاظوں میں سناتا ہے",
  "ماحول میں موجود آوازوں کو سن کر شناخت کرتا ہے",
];

const SPEAKING_LABELS = [
  "اساتذہ سے گفتگو کرتے ہیں۔",
  "ہم جماعت ساتھیوں سے گفتگو اعتماد سے کرتے ہیں۔",
  "ماحول میں پائی جانے والی چیزوں کا نام بتاتے ہیں۔",
  "خیالات اور احساسات کا واضح الفاظ میں اظہار کرتے ہیں۔",
  "تخلیقی نوعیت کے سوالوں کے جواب دیتے ہیں۔",
  "چھوٹے چھوٹے اور عام نوعیت کے سوالات کرتے ہیں۔",
  "طے شدہ نصاب کے مطابق حروف کی آوازیں نکال لیتے ہیں/ پڑھائی۔",
  "سنی ہوئی بات/ واقعات/ تجربات کو اپنے لفظوں میں دہراتے ہیں۔",
  "ان سنائی گئی کہانی کو تسلسل سے سناتے/ دہراتے ہیں۔",
  "تصاویر کو دیکھ کر کہانی سناتے ہیں/ تصویروں کو الفاظ میں بیان کرتے ہیں۔",
];

const READING_LABELS = [
  "کتابوں سے لطف اندوز ہوتے ہیں",
  "پڑھنے میں دلچسپی کا اظہار کرتے ہیں",
  "Sight reading کی مدد سے بار بار دیکھے جانے والے حروف / الفاظ پڑھنا",
  "تصویروں کی مدد سے کہانی پڑھ کر سناتے ہیں",
  "جماعت کے ماحول میں لکھے گئے الفاظ / جملوں کو پڑھنا",
  "اپنا نام اردو میں / انگریزی میں پہچاننا",
  "سادہ تصویر دیکھ کر اسے بیان کرنا",
  "اپنے اسکول کا نام اردو میں / انگریزی میں پہچاننا",
  "ہوا میں / کسی بھی سطح پر انگلی کے اشارے کی مدد سے لکھے گئے انگریزی کے حروف پڑھنا",
  "ہوا میں / کسی بھی سطح پر انگلی کے اشارے کی مدد سے لکھے گئے اردو کے حروف تہجی پڑھنا",
  "یونٹ کے نصاب کے مطابق انگریزی کے تمام مطلوبہ حروف تہجی / الفاظ / جملے روانی سے پڑھنا",
  "یونٹ کے نصاب کے مطابق اردو کے تمام مطلوبہ حروف تہجی / الفاظ / جملے روانی سے پڑھنا",
  "انگریزی حروف تہجی کے صوتی انداز کو پہچاننا",
  "اردو حروف تہجی کے صوتی انداز کو پہچاننا",
];

const WRITING_LABELS = [
  "یونٹ کے نصاب کے مطابق اردو کے تمام مطلوبہ حروف کو خوشخط لکھنا",
  "لکھنے میں دلچسپی کا اظہار کرتا",
  "ہوا میں / کسی بھی سطح پر انگلی کے اشارے کی مدد سے انگریزی کے حروف تہجی لکھنا",
  "ہوا میں / کسی بھی سطح پر انگلی کے اشارے کی مدد سے اردو کے حروف تہجی لکھنا",
  "دو کالموں میں لکھے گئے ایک جیسے حروف کو لکیروں کی مدد سے ملانا",
  "لکیروں کی مدد سے حروف کو متعلقہ تصویر سے ملانا",
  "اپنا نام انگریزی میں لکھنا",
  "اپنا نام اردو میں لکھنا",
  "یونٹ کے نصاب کے مطابق انگریزی کے تمام مطلوبہ حروف کو خوشخط لکھنا",
];

const HEALTH_HYGIENE_LABELS = [
  "اپنا جسم، لباس، جوتے اور موزے صاف رکھنا",
  "دانتوں کی صفائی کا خیال رکھنا",
  "وقفے میں صاف ستھری اور غذائیت والی اشیاء استعمال کرنا",
  "کھانے سے پہلے اور بعد میں ہاتھ دھونا",
  "ناقص اشیاء کے کھانے (کولڈ ڈرنک، پاپڑ، چھالیہ وغیرہ) سے اجتناب کرنا",
  "حاجت سے فراغت کے بعد صابن سے ہاتھ دھونا",
  "کچرا ہمیشہ کوڑے دان میں ڈالنا",
  "ناخن ہر ہفتے تراشنا",
  "تھوکنے کے لئے واش بیسن کا استعمال کرنا",
  "روزانہ یا ہر دوسرے دن غسل کرنا",
  "گندگی کے نقصانات اور صفائی کے فائدے سے واقف ہونا",
  "بالوں کو چھوٹا رکھنا (لڑکوں کے لئے)",
  "روزانہ ورزش کرنا",
  "بالوں اور سر کی صفائی ہونا",
  "ساتھی بچوں کو بھی درجہ بالا کے حوالے سے متوجہ کرنا",
  "مناسب طریقے سے کنگھی کرنا",
];

const PHYSICAL_LABELS = [
  "آسانی سے سیڑھیاں چڑھنا اور اترنا",
  "موتیوں کو دھاگے میں پرونا",
  "مناسب وزن اٹھا لینا",
  "قینچی سے تصویریں کاٹنا",
  "وزن یا کوئی اور چیز کھینچنا",
  "ڈیزائن / تصویر کو چپکانا",
  "متعین کی گئی لکڑیوں پر توازن کے ساتھ آگے کی جانب چلنا",
  "پلاسٹک / ٹکڑی / پتھر کے ہموار ٹکڑوں کی مدد سے مینار بنانا",
  "متعین کی گئی لکیروں پر توازن کے ساتھ پیچھے کی جانب چلنا",
  "گول / چوکور چیز کے گرد دائرہ لگانا",
  "بغیر رکے بھاگنا / دائیں اور بائیں (زگ زیگ) بھاگنا",
  "گلاس سے گلاس میں اور جگ سے گلاس میں پانی انڈیلنا",
  "گیند کو ایک ہاتھ سے پھینکنا",
  "بلاک جوڑ کر مختلف نمونے بنانا",
  "مختلف صورتوں میں رکھے گئے بلاکس پر توازن کے ساتھ چل لینا",
  "زپ بند کرنا اور بٹن لگانا",
  "دونوں پاؤں پر آگے کی جانب بیک وقت کئی بار اچھلنا",
  "چمٹی پلک کو ٹوکری / کپڑے کے کناروں پر لگانا",
  "کسی ایک پاؤں پر ۱۰ تا ۱۵ سیکنڈ کھڑے ہونا",
  "ایک پیالی میں موجود پانی کو چمچ کی مدد سے دوسری پیالی میں ڈالنا",
  "پاؤں سے گیند کو مارتے ہوئے ٹانگوں کا صحیح استعمال کرنا",
  "دالوں / موتیوں کو چمچ کی مدد سے ایک پیالی سے دوسری پیالی میں ڈالنا",
];

const SOCIAL_LABELS = [
  "بیشتر وقت خوش رہنا",
  "اسکول سے خوشگوار تعلق محسوس کرنا",
  "ناخوشگوار صورتحال پیش آنے پر جلد ہی خود پر قابو پا لینا",
  "ہم عمر بچوں کے ساتھ تعلقات استوار کرنا",
  "کسی کام کو مکمل کرنے کے بعد خوشی محسوس کرنا اور شکر ادا کرنا",
  "استاد سے قلبی تعلق محسوس کرنا",
  "سرگرمیوں میں خوشی سے حصہ لینا اور پرجوش رہنا",
  "اپنے خیالات اور احساسات کا اظہار آسانی سے پیش کرنا",
  "ضرورت محسوس ہونے پر مدد کے لئے تعاون کی درخواست کرنا",
  "اپنی پسند، ناپسند کا اظہار موزوں الفاظ میں کرنا",
  "کسی ساتھی کی مدد کے لئے بلا تامل تعاون پیش کرنا",
  "باری کا انتظار کرنا",
  "اپنی اور دوسروں کی چیزوں کی حفاظت کرنا",
  "خود اعتمادی (بات چیت اور کاموں کے دوران مشاہدہ)",
  "ناپسندیدہ حرکات کو متوجہ کرا نے پر چھوڑ دینا",
  "کام سمجھ نہ آنے پر پوچھنا",
  "اسکول میں جگہ اور ساتھی کی تبدیلی سے متاثر نہ ہونا",
  "کسی کام کے موقع پر خود کو پیش کرنا",
  "جمعہ، عیدین، رمضان اور لیلۃ القدر کا فہم رکھنا",
  "دوسروں کی چیز اجازت لے کر استعمال کرنا",
  "جذبات کا اظہار موزوں طریقے سے کرنا",
  "اپنی چیزیں بوقت ضرورت استعمال کے لئے پیش کرنا",
  "ہم جماعتوں کے ساتھ گروہ میں کام کرنا",
  "اصول و ضوابط (کمرہ جماعت، اسمبلی، وقفہ، چھٹی، پانی وغیرہ) پر عمل کرنا",
];

const ENVIRONMENT_LABELS = [
  "یادداشت کے ذریعے ایک دفعہ دیکھی گئی اشیاء / جگہ کے بارے میں بتانا",
  "ماحول میں موجود چیزوں کا غور و مشاہدہ کرنا",
  "کم از کم چار نقل و حمل کے ذرائع کے بارے میں بات کرنا",
  "تجربات کرنا اور انکے نتائج بیان کرنا (نصاب کے مطابق)",
  "کم از کم چار پالتو جانوروں کے بارے میں بات کرنا",
  "پھل، سبزیاں اور درخت کو پہچاننا",
  "کم از کم چار جنگلی جانوروں کے بارے میں بات کرنا",
  "پانی کے فوائد اور استعمال میں احتیاط سے واقف ہونا",
  "کم از کم چار پرندوں کے بارے میں بات کرنا",
  "سنت نبوی ﷺ کے مطابق پانی پینے کے طریقے سے واقف ہونا",
  "کم از کم چار سبزیوں اور چار پھلوں کے بارے میں بات کرنا",
  "چھو کر (بغیر دیکھے) روز مرہ کی اشیاء کی شناخت کرنا",
];

const MATH_LABELS = [
  "Recognizes and matches colours",
  "Recognizes and matches shapes",
  "Recognizes and matches number",
  "Writes numbers in sequence",
  "Associates quantities with numbers",
  "Counts up to __ / Oral Counting up to _",
  "Makes symbols of right (✓), wrong (X) & circle (O)",
  "Recognizes current coins of _,_,_,_",
  "Segregates things according to the given concept",
  "Big and Small",
  "Light, Medium & Heavy",
  "Less and More",
  "Thin and Thick",
  "Full and Empty",
  "Hot, Cold & Normal",
  "Tall and Short",
  "Long and Short",
  "In and Out",
  "Few and Many",
  "Open and Closed",
  "Long and Short",
  "Wide and Narrow",
  "Straight and Curved",
  "On and Off",
  "Rough and Smooth",
];

function labelForSectionCriterion(section, criterion) {
  if (!criterion) return "";
  const index = (Number(criterion?.order) || 1) - 1;
  if (section?.key === "listening") {
    return LISTENING_LABELS[index] || "";
  }
  if (section?.key === "speaking") {
    return SPEAKING_LABELS[index] || "";
  }
  if (section?.key === "reading") {
    return READING_LABELS[index] || "";
  }
  if (section?.key === "writing") {
    return WRITING_LABELS[index] || "";
  }
  if (section?.key === "health_hygiene") {
    return HEALTH_HYGIENE_LABELS[index] || "";
  }
  if (section?.key === "physical_development") {
    return PHYSICAL_LABELS[index] || "";
  }
  if (section?.key === "social_emotional") {
    return SOCIAL_LABELS[index] || "";
  }
  if (section?.key === "environment_science") {
    return ENVIRONMENT_LABELS[index] || "";
  }
  if (section?.key === "mathematical_development") {
    return MATH_LABELS[index] || "";
  }
  return labelForCriterion(criterion);
}

function getSectionCriteria(section) {
  if (!section) return [];
  if (section.key === "listening") {
    return LISTENING_LABELS.map((label, index) => ({
      key: `listening:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "speaking") {
    return SPEAKING_LABELS.map((label, index) => ({
      key: `speaking:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "reading") {
    return READING_LABELS.map((label, index) => ({
      key: `reading:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "writing") {
    return WRITING_LABELS.map((label, index) => ({
      key: `writing:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "health_hygiene") {
    return HEALTH_HYGIENE_LABELS.map((label, index) => ({
      key: `health_hygiene:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "physical_development") {
    return PHYSICAL_LABELS.map((label, index) => ({
      key: `physical_development:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "social_emotional") {
    return SOCIAL_LABELS.map((label, index) => ({
      key: `social_emotional:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "environment_science") {
    return ENVIRONMENT_LABELS.map((label, index) => ({
      key: `environment_science:${index + 1}`,
      order: index + 1,
      label_ur: label,
      language: "ur",
    }));
  }
  if (section.key === "mathematical_development") {
    return MATH_LABELS.map((label, index) => ({
      key: `mathematical_development:${index + 1}`,
      order: index + 1,
      label_en: label,
      language: "en",
    }));
  }
  return section.criteria || [];
}

function mainHeadingForSection(section) {
  const key = String(section?.key || "");
  if (["listening", "speaking", "reading", "writing"].includes(key)) return "Language Development";
  if (key === "health_hygiene") return "Hygiene & Health";
  if (key === "physical_development") return "Physical Development";
  if (key === "social_emotional") return "Social & Emotional Development";
  if (key === "environment_science") return "Science & Environment";
  if (key === "mathematical_development") return "Mathematical Development";
  return section?.title_en || "Assessment";
}

function responseKey(section, criterion) {
  return `${section.key}:${criterion.order}`;
}

function pairCriteria(criteria = []) {
  const pairs = [];
  for (let index = 0; index < criteria.length; index += 2) {
    pairs.push([criteria[index], criteria[index + 1] || null]);
  }
  return pairs;
}

function normalizeResponses(sections = [], existing = {}) {
  const next = {};
  for (const section of sections) {
    for (const criterion of getSectionCriteria(section)) {
      const key = responseKey(section, criterion);
      next[key] = existing?.[key] || { mt: "", ft: "", remarks: "" };
    }
  }
  return next;
}

function buildStudentInfo(student, academicYear, term) {
  return {
    studentName: student?.student_name || "",
    fatherName: student?.father_name || "",
    className: student?.class_name || "",
    rollNo: student?.admission_no || "",
    age: dateInputValue(student?.date_of_birth) || "",
    academicYear: academicYear || "",
    term: term || "",
    picturePath: student?.profile_picture_url || student?.profile_picture_path || "",
    attendanceTd: "",
    attendancePd: "",
  };
}

const STUDENT_INFO_REQUIRED_FIELDS = [
  "studentName",
  "fatherName",
  "className",
  "rollNo",
  "age",
  "academicYear",
  "term",
  "picturePath",
  "attendanceTd",
  "attendancePd",
];

function dedupeStudents(rows = []) {
  const seen = new Map();
  for (const row of rows || []) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    const subjectId = String(row?.subject_id || "").trim();
    const subjectName = String(row?.subject_name || "").trim();
    if (!seen.has(id)) {
      seen.set(id, {
        ...row,
        subjects: subjectId || subjectName ? [{ id: subjectId, name: subjectName }] : [],
      });
      continue;
    }
    const existing = seen.get(id);
    const subjects = [...(existing.subjects || [])];
    if ((subjectId || subjectName) && !subjects.some((subject) => subject.id === subjectId && subject.name === subjectName)) {
      subjects.push({ id: subjectId, name: subjectName });
    }
    seen.set(id, {
      ...existing,
      profile_picture_url: existing.profile_picture_url || row.profile_picture_url || "",
      profile_picture_path: existing.profile_picture_path || row.profile_picture_path || "",
      father_name: existing.father_name || row.father_name || "",
      class_name: existing.class_name || row.class_name || "",
      admission_no: existing.admission_no || row.admission_no || "",
      age: existing.age || row.age || "",
      date_of_birth: existing.date_of_birth || row.date_of_birth,
      subjects,
    });
  }
  return Array.from(seen.values());
}

function AttendancePieChart({ attendance }) {
  const present = Number(attendance?.present || 0);
  const absent = Number(attendance?.absent || 0);
  const total = Math.max(Number(attendance?.total || 0), present + absent);
  const presentPercent = total > 0 ? Math.round((present / total) * 100) : 0;
  const absentPercent = total > 0 ? 100 - presentPercent : 0;

  const pieBackground = total > 0
    ? (present === total
      ? "#EAB308"
      : absent === total
        ? "#EF4444"
        : `conic-gradient(#EAB308 0% ${presentPercent}%, #EF4444 ${presentPercent}% 100%)`)
    : "#E5E7EB";

  return (
    <div className="flex flex-col justify-between gap-2.5 rounded-[1.15rem] border border-[#2D8A6A]/15 bg-white/95 p-3 shadow-xs w-full max-w-[280px] sm:w-[280px]">
      <div className="flex items-center justify-between w-full border-b border-[#2D8A6A]/10 pb-1.5">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#0D5C48]">Attendance</p>
        <span className="rounded-full bg-[#FAF7F0] border border-[#2D8A6A]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#063F32]">
          Total: {total} Days
        </span>
      </div>

      {/* Pie Chart & Stacked Rows for Present & Absent */}
      <div className="flex items-center justify-between gap-3 w-full my-auto">
        <div className="relative group shrink-0">
          <div
            className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-[0_4px_14px_-3px_rgba(0,0,0,0.18)] border-2 border-white transition-transform duration-200 group-hover:scale-105"
            style={{ background: pieBackground }}
            title={`Total Days: ${total} | Present: ${present} (${presentPercent}%) | Absent: ${absent} (${absentPercent}%)`}
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {/* Row 1: Present */}
          <div className="rounded-lg bg-[#FEFCE8] border border-[#FEF08A] px-2.5 py-1.5 flex items-center justify-between gap-1.5 shadow-2xs">
            <div className="flex items-center gap-1 shrink-0">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EAB308] border border-white shadow-xs" />
              <span className="text-[11px] font-bold text-[#854D0E]">Present</span>
            </div>
            <span className="text-[11px] font-black text-[#713F12] whitespace-nowrap">
              {present} <span className="text-[10px] font-semibold text-[#854D0E]/80">({presentPercent}%)</span>
            </span>
          </div>

          {/* Row 2: Absent */}
          <div className="rounded-lg bg-[#FEF2F2] border border-[#FECACA] px-2.5 py-1.5 flex items-center justify-between gap-1.5 shadow-2xs">
            <div className="flex items-center gap-1 shrink-0">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#EF4444] border border-white shadow-xs" />
              <span className="text-[11px] font-bold text-rose-700">Absent</span>
            </div>
            <span className="text-[11px] font-black text-rose-800 whitespace-nowrap">
              {absent} <span className="text-[10px] font-semibold text-rose-700/80">({absentPercent}%)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

let memoryPrefillAssessment = null;

export function setEcceMemoryPrefill(item) {
  memoryPrefillAssessment = item;
}

function getStoredPrefill() {
  if (memoryPrefillAssessment) {
    const item = memoryPrefillAssessment;
    memoryPrefillAssessment = null;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("ecce_prefill_assessment");
      } catch { }
    }
    return item;
  }

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("ecce_prefill_assessment");
      if (!raw) return null;
      sessionStorage.removeItem("ecce_prefill_assessment");
      const parsed = JSON.parse(raw);
      const item = parsed?.item || parsed;
      const ts = parsed?.timestamp || 0;
      const params = new URLSearchParams(window.location.search);
      const sId = params.get("studentId");
      const aId = params.get("assessmentId");
      if (aId && String(item?.id) === String(aId)) {
        return item;
      }
      if (sId && String(item?.student_id) === String(sId)) {
        return item;
      }
      if (ts && Date.now() - ts < 60000) {
        return item;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export default function EcceAssessmentsPage({ portal = "teacher", title = "ECCE Assessments", description = "Complete, review, and share official ECCE assessment reports.", showTeacherForm = true }) {
  const router = useRouter();
  const isTeacher = portal === "teacher";
  const canShowTeacherForm = isTeacher && showTeacherForm;
  const canShowReports = !isTeacher || !showTeacherForm;
  const isManager = ["coordinator", "superadmin", "admin"].includes(portal);
  const isReadonly = ["parent", "student"].includes(portal);
  const filterGridClass = canShowReports
    ? ((isManager || isTeacher) ? "grid gap-4 md:grid-cols-2 lg:grid-cols-5" : "grid gap-4 md:grid-cols-2 lg:grid-cols-4")
    : ((isManager || isTeacher) ? "grid gap-4 md:grid-cols-2 lg:grid-cols-4" : "grid gap-4 md:grid-cols-3");

  const initialPrefill = useMemo(() => (canShowTeacherForm ? getStoredPrefill() : null), [canShowTeacherForm]);

  const [loading, setLoading] = useState(!initialPrefill);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState(ECCE_SECTIONS);
  const [subjects, setSubjects] = useState(ECCE_SUBJECTS);
  const [terms, setTerms] = useState(ECCE_TERMS);
  const [selectedClass, setSelectedClass] = useState(() => initialPrefill?.class_name || "");
  const [selectedStudentId, setSelectedStudentId] = useState(() => initialPrefill?.student_id || "");
  const [academicYear, setAcademicYear] = useState(() => initialPrefill?.academic_year || (canShowTeacherForm ? currentYear() : ""));
  const [term, setTerm] = useState(() => initialPrefill?.term || (canShowTeacherForm ? "Mid Term" : ""));
  const [selectedStatus, setSelectedStatus] = useState("");
  const [responses, setResponses] = useState(() => {
    if (initialPrefill?.responses) {
      const parsedResp = typeof initialPrefill.responses === "string" ? JSON.parse(initialPrefill.responses) : initialPrefill.responses;
      return {
        ...normalizeResponses(ECCE_SECTIONS),
        ...parsedResp,
      };
    }
    return normalizeResponses(ECCE_SECTIONS);
  });
  const [studentInfo, setStudentInfo] = useState(() => {
    if (!initialPrefill) return buildStudentInfo(null, canShowTeacherForm ? currentYear() : "", canShowTeacherForm ? "Mid Term" : "");
    const parsedResp = typeof initialPrefill.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill.responses || {});
    const sInfo = parsedResp?.__studentInfo || {};
    return {
      studentName: sInfo.studentName || initialPrefill.student_name || "",
      fatherName: sInfo.fatherName || initialPrefill.father_name || "",
      className: sInfo.className || initialPrefill.class_name || "",
      rollNo: sInfo.rollNo || initialPrefill.admission_no || "",
      age: sInfo.age || initialPrefill.age || dateInputValue(initialPrefill.date_of_birth) || "",
      academicYear: initialPrefill.academic_year || sInfo.academicYear || currentYear(),
      term: initialPrefill.term || sInfo.term || "Mid Term",
      picturePath: sInfo.picturePath || initialPrefill.profile_picture_url || initialPrefill.profile_picture_path || "",
      attendanceTd: sInfo.attendanceTd || (initialPrefill.attendance?.total ? String(initialPrefill.attendance.total) : ""),
      attendancePd: sInfo.attendancePd || (initialPrefill.attendance?.present ? String(initialPrefill.attendance.present) : ""),
    };
  });
  const [teacherRemarks, setTeacherRemarks] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__remarks?.teacher || initialPrefill?.teacher_remarks || "";
  });
  const [principalRemarks, setPrincipalRemarks] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__remarks?.principal || "";
  });
  const [parentRemarks, setParentRemarks] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__remarks?.parents || "";
  });
  const [teacherSignature, setTeacherSignature] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__signatures?.teacher || "";
  });
  const [principalSignature, setPrincipalSignature] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__signatures?.principal || "";
  });
  const [parentSignature, setParentSignature] = useState(() => {
    const parsedResp = typeof initialPrefill?.responses === "string" ? JSON.parse(initialPrefill.responses) : (initialPrefill?.responses || {});
    return parsedResp?.__signatures?.parents || "";
  });
  const [subjectPerformance, setSubjectPerformance] = useState(() => {
    const rawPerf = typeof initialPrefill?.subject_performance === "string" ? JSON.parse(initialPrefill.subject_performance) : (initialPrefill?.subject_performance || []);
    if (Array.isArray(rawPerf) && rawPerf.length > 0) {
      return rawPerf.map((p) => ({ ...p, subject: p.subject === "دینی" ? "فہمِ دین" : p.subject }));
    }
    return ECCE_SUBJECTS.map((subject) => ({ subject, performance: "", midPerformance: "", midRemarks: "", finalPerformance: "", finalRemarks: "" }));
  });
  const [reviewComments, setReviewComments] = useState({});
  const [correctionModalItem, setCorrectionModalItem] = useState(null);
  const [correctionComment, setCorrectionComment] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [activeTeacherStep, setActiveTeacherStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [reportPage, setReportPage] = useState(1);
  const [successToast, setSuccessToast] = useState(null);
  const [uploadedPhotoPreview, setUploadedPhotoPreview] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const pendingPhotoFileRef = useRef(null);
  const [editingAssessmentId, setEditingAssessmentId] = useState(() => initialPrefill?.id || null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const toastTimeoutRef = useRef(null);
  const stepTabsContainerRef = useRef(null);
  const stepTabRefs = useRef([]);

  function triggerSuccessToast(msg, toastTitle = "Assessment Submitted") {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setSuccessToast({ title: toastTitle, message: msg });
    toastTimeoutRef.current = setTimeout(() => {
      setSuccessToast(null);
    }, 4500);
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sId = params.get("studentId");
      const aYear = params.get("academicYear");
      const t = params.get("term");
      if (sId) setSelectedStudentId(sId);
      if (aYear) setAcademicYear(aYear);
      if (t) setTerm(t);
    }
  }, []);

  useEffect(() => {
    const activeEl = stepTabRefs.current[activeTeacherStep];
    const container = stepTabsContainerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      const offset = activeRect.left - containerRect.left - (containerRect.width / 2) + (activeRect.width / 2);
      container.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, [activeTeacherStep]);

  async function loadData(showLoading = !initialPrefill, overrideStudentId = null) {
    if (showLoading) setLoading(true);
    setMessage("");
    try {
      let initialSId = overrideStudentId !== null ? overrideStudentId : selectedStudentId;
      let initialYear = academicYear;
      let initialT = term;
      let initialAssessmentId = null;
      if (typeof window !== "undefined" && overrideStudentId === null) {
        const params = new URLSearchParams(window.location.search);
        if (params.get("studentId")) initialSId = params.get("studentId");
        if (params.get("assessmentId")) initialAssessmentId = params.get("assessmentId");
        if (params.get("academicYear")) initialYear = params.get("academicYear");
        if (params.get("term")) initialT = params.get("term");
      }

      const response = await fetch("/api/ecce-assessments", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load assessments.");
      const nextStudents = dedupeStudents(data.students || []);
      const nextItems = data.items || [];
      setStudents(nextStudents);
      setItems(nextItems);
      setClasses(data.classes || []);
      const nextSections = data.sections?.length ? data.sections : ECCE_SECTIONS;
      setSections(nextSections);
      const initialSubjects = (data.subjects?.length ? data.subjects : ECCE_SUBJECTS).map((s) => (s === "دینی" ? "فہمِ دین" : s));
      setSubjects(initialSubjects);
      setTerms(data.terms?.length ? data.terms : ECCE_TERMS);

      if (initialSId || initialAssessmentId) {
        if (initialSId) setSelectedStudentId(initialSId);
        if (initialYear) setAcademicYear(initialYear);
        if (initialT) setTerm(initialT);

        const selStudent = nextStudents.find((s) => String(s.id) === String(initialSId));
        const matchingAssessment =
          (initialAssessmentId ? nextItems.find((a) => String(a.id) === String(initialAssessmentId)) : null) ||
          nextItems.find(
            (a) =>
              String(a.student_id) === String(initialSId) &&
              (!initialYear.trim() || String(a.academic_year || "").trim().toLowerCase() === initialYear.trim().toLowerCase()) &&
              (!initialT.trim() || String(a.term || "").trim().toLowerCase() === initialT.trim().toLowerCase())
          ) ||
          nextItems.find(
            (a) =>
              String(a.student_id) === String(initialSId) &&
              (!initialT.trim() || String(a.term || "").trim().toLowerCase() === initialT.trim().toLowerCase())
          ) ||
          nextItems.find((a) => String(a.student_id) === String(initialSId));

        const itemToApply = initialPrefill || (initialAssessmentId ? matchingAssessment : null);

        if (itemToApply && (itemToApply.responses || itemToApply.id)) {
          setEditingAssessmentId(itemToApply.id || null);
          const parsedResponses = typeof itemToApply.responses === "string" ? JSON.parse(itemToApply.responses) : (itemToApply.responses || {});
          const sInfo = parsedResponses?.__studentInfo || {};
          const rem = parsedResponses?.__remarks || {};
          const sig = parsedResponses?.__signatures || {};

          if (itemToApply.class_name || selStudent?.class_name) {
            setSelectedClass(itemToApply.class_name || selStudent?.class_name || "");
          }
          if (itemToApply.student_id) {
            setSelectedStudentId(itemToApply.student_id);
          }
          if (itemToApply.academic_year) {
            setAcademicYear(itemToApply.academic_year);
          }
          if (itemToApply.term) {
            setTerm(itemToApply.term);
          }

          setStudentInfo({
            studentName: sInfo.studentName || itemToApply.student_name || selStudent?.student_name || "",
            fatherName: sInfo.fatherName || itemToApply.father_name || selStudent?.father_name || "",
            className: sInfo.className || itemToApply.class_name || selStudent?.class_name || "",
            rollNo: sInfo.rollNo || itemToApply.admission_no || selStudent?.admission_no || "",
            age: sInfo.age || itemToApply.age || dateInputValue(itemToApply.date_of_birth) || selStudent?.age || "",
            academicYear: itemToApply.academic_year || sInfo.academicYear || initialYear || currentYear(),
            term: itemToApply.term || sInfo.term || initialT || "Mid Term",
            picturePath: sInfo.picturePath || itemToApply.profile_picture_url || itemToApply.profile_picture_path || selStudent?.profile_picture_url || selStudent?.profile_picture_path || "",
            attendanceTd: sInfo.attendanceTd || (itemToApply.attendance?.total ? String(itemToApply.attendance.total) : ""),
            attendancePd: sInfo.attendancePd || (itemToApply.attendance?.present ? String(itemToApply.attendance.present) : ""),
          });

          setResponses({
            ...normalizeResponses(nextSections),
            ...parsedResponses,
          });

          const rawSubjectPerf = typeof itemToApply.subject_performance === "string" ? JSON.parse(itemToApply.subject_performance) : (itemToApply.subject_performance || []);
          if (Array.isArray(rawSubjectPerf) && rawSubjectPerf.length > 0) {
            setSubjectPerformance(rawSubjectPerf.map((p) => ({ ...p, subject: p.subject === "دینی" ? "فہمِ دین" : p.subject })));
          }
          setTeacherRemarks(rem.teacher || itemToApply.teacher_remarks || "");
          setPrincipalRemarks(rem.principal || "");
          setParentRemarks(rem.parents || "");
          setTeacherSignature(sig.teacher || "");
          setPrincipalSignature(sig.principal || "");
          setParentSignature(sig.parents || "");
        } else if (selStudent) {
          const baseInfo = buildStudentInfo(selStudent, initialYear, initialT);
          setStudentInfo(baseInfo);
        }
      } else {
        if (!initialPrefill) {
          setResponses((current) => ({
            ...normalizeResponses(nextSections),
            ...current,
          }));
          setSubjectPerformance((current) => {
            if (current && current.length > 0 && current.some((r) => r.performance || r.midPerformance)) {
              return current;
            }
            return initialSubjects.map((subject) => ({ subject, performance: "", midPerformance: "", midRemarks: "", finalPerformance: "", finalRemarks: "" }));
          });
        }
      }
      if (typeof window !== "undefined" && window.location.search) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load assessments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === String(selectedStudentId)) || null,
    [students, selectedStudentId]
  );

  const classOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];

    if (canShowReports) {
      for (const item of items || []) {
        const title = String(item?.class_name || item?.responses?.__studentInfo?.className || "").trim();
        if (!title || seen.has(title)) continue;
        seen.add(title);
        rows.push(title);
      }
      return rows;
    }

    if (selectedClass) {
      seen.add(selectedClass);
      rows.push(selectedClass);
    }
    for (const item of classes || []) {
      const title = String(item?.title || "").trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      rows.push(title);
    }
    for (const student of students || []) {
      const title = String(student?.class_name || "").trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      rows.push(title);
    }
    for (const item of items || []) {
      const title = String(item?.class_name || item?.responses?.__studentInfo?.className || "").trim();
      if (!title || seen.has(title)) continue;
      seen.add(title);
      rows.push(title);
    }
    return rows;
  }, [canShowReports, classes, students, items, selectedClass]);

  const academicYearOptions = useMemo(() => {
    const yearsSet = new Set();

    if (canShowReports) {
      for (const item of items || []) {
        const y = String(item?.academic_year || item?.responses?.__studentInfo?.academicYear || "").trim();
        if (y) yearsSet.add(y);
      }
      return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }

    const cYear = new Date().getFullYear();
    for (let y = cYear - 2; y <= cYear + 1; y++) {
      yearsSet.add(String(y));
    }

    for (const item of items || []) {
      const y = String(item?.academic_year || item?.responses?.__studentInfo?.academicYear || "").trim();
      if (y) yearsSet.add(y);
    }

    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [canShowReports, items]);

  const termOptions = useMemo(() => {
    if (canShowReports) {
      const seen = new Set();
      const rows = [];
      for (const item of items || []) {
        const t = String(item?.term || item?.responses?.__studentInfo?.term || "").trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        rows.push(t);
      }
      return rows;
    }
    return terms;
  }, [canShowReports, items, terms]);

  const statusOptions = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const item of items || []) {
      const st = String(item?.status || "").trim().toUpperCase();
      if (!st || seen.has(st)) continue;
      seen.add(st);
      rows.push(st);
    }
    return rows;
  }, [items]);

  const studentOptions = useMemo(() => {
    if (canShowReports) {
      const seen = new Set();
      const rows = [];
      for (const item of items || []) {
        if (selectedClass && String(item.class_name || "").trim().toLowerCase() !== selectedClass.trim().toLowerCase()) continue;
        if (academicYear.trim() && String(item.academic_year || "").trim().toLowerCase() !== academicYear.trim().toLowerCase()) continue;
        if (term.trim() && String(item.term || "").trim().toLowerCase() !== term.trim().toLowerCase()) continue;
        const sId = String(item.student_id);
        if (!seen.has(sId)) {
          seen.add(sId);
          rows.push({ id: sId, student_name: item.student_name });
        }
      }
      return rows;
    }

    const filtered = students.filter((student) => {
      const matchesClass = selectedClass ? String(student.class_name || "").trim().toLowerCase() === selectedClass.trim().toLowerCase() : true;
      return matchesClass;
    });

    if (selectedStudentId && !filtered.some((s) => String(s.id) === String(selectedStudentId))) {
      filtered.unshift({
        id: selectedStudentId,
        student_name: studentInfo?.studentName || "Selected Student",
        class_name: selectedClass || studentInfo?.className || "",
      });
    }

    return filtered;
  }, [canShowReports, items, selectedClass, academicYear, term, students, selectedStudentId, studentInfo.studentName, studentInfo.className]);

  const teacherSteps = useMemo(() => [
    { type: "student", key: "student_information", label: "Student Information" },
    ...sections.map((section) => ({ type: "section", key: section.key, label: section.title_en, section })),
    { type: "performance", key: "subject_performance", label: "Subject Wise Performance" },
  ], [sections]);

  const activeTeacherStepItem = teacherSteps[Math.min(activeTeacherStep, Math.max(teacherSteps.length - 1, 0))];

  const currentExistingAssessment = useMemo(() => {
    return items.find(
      (item) =>
        String(item.student_id) === String(selectedStudentId) &&
        (!academicYear.trim() || String(item.academic_year || "").trim().toLowerCase() === academicYear.trim().toLowerCase()) &&
        (!term.trim() || String(item.term || "").trim().toLowerCase() === term.trim().toLowerCase())
    ) || items.find((item) => String(item.student_id) === String(selectedStudentId));
  }, [items, selectedStudentId, academicYear, term]);

  const selectedStudentPhoto = useMemo(() => {
    if (uploadedPhotoPreview) {
      return uploadedPhotoPreview;
    }

    if (studentInfo.picturePath) {
      const p = String(studentInfo.picturePath).trim();
      if (/^https?:\/\//i.test(p) || p.startsWith("blob:") || p.startsWith("data:")) {
        return p;
      }
      return buildPreviewUrl(p);
    }

    if (selectedStudent?.profile_picture_url) {
      return selectedStudent.profile_picture_url;
    }

    if (selectedStudent?.profile_picture_path) {
      return buildPreviewUrl(selectedStudent.profile_picture_path);
    }

    if (currentExistingAssessment?.profile_picture_url) {
      return currentExistingAssessment.profile_picture_url;
    }

    const anyAssessment = items.find(
      (a) =>
        String(a.student_id) === String(selectedStudentId) &&
        (a.profile_picture_url || a.profile_picture_path || a.responses?.__studentInfo?.picturePath)
    );

    if (anyAssessment?.profile_picture_url) {
      return anyAssessment.profile_picture_url;
    }

    const fallbackPath =
      anyAssessment?.profile_picture_path ||
      anyAssessment?.responses?.__studentInfo?.picturePath ||
      currentExistingAssessment?.profile_picture_path ||
      currentExistingAssessment?.responses?.__studentInfo?.picturePath ||
      "";

    if (fallbackPath) {
      return buildPreviewUrl(fallbackPath);
    }

    return "";
  }, [uploadedPhotoPreview, studentInfo.picturePath, selectedStudent, currentExistingAssessment, items, selectedStudentId]);

  function handleStudentChange(newId) {
    setSelectedStudentId(newId);
    setEditingAssessmentId(null);
    setUploadedPhotoPreview("");
    setMessage("");

    if (!newId) {
      setStudentInfo(buildStudentInfo(null, academicYear, term));
      setResponses(normalizeResponses(sections));
      setSubjectPerformance(
        subjects.map((subject) => ({
          subject,
          performance: "",
          midPerformance: "",
          midRemarks: "",
          finalPerformance: "",
          finalRemarks: "",
        }))
      );
      setTeacherRemarks("");
      setPrincipalRemarks("");
      setParentRemarks("");
      setTeacherSignature("");
      setPrincipalSignature("");
      setParentSignature("");
      setFieldErrors({});
      return;
    }

    const student = students.find((s) => String(s.id) === String(newId));
    const matchingAssessment = items.find(
      (a) => String(a.student_id) === String(newId) && (a.profile_picture_url || a.profile_picture_path || a.responses?.__studentInfo?.picturePath)
    );
    const resolvedPicture =
      student?.profile_picture_url ||
      student?.profile_picture_path ||
      matchingAssessment?.profile_picture_url ||
      matchingAssessment?.profile_picture_path ||
      matchingAssessment?.responses?.__studentInfo?.picturePath ||
      "";

    const baseInfo = buildStudentInfo(student, academicYear, term);

    setStudentInfo({
      ...baseInfo,
      attendanceTd: "",
      attendancePd: "",
      picturePath: resolvedPicture,
    });

    // Reset evaluation responses fresh for the newly selected student to start a new assessment
    setResponses(normalizeResponses(sections));
    setSubjectPerformance(
      subjects.map((subject) => ({
        subject,
        performance: "",
        midPerformance: "",
        midRemarks: "",
        finalPerformance: "",
        finalRemarks: "",
      }))
    );
    setTeacherRemarks("");
    setPrincipalRemarks("");
    setParentRemarks("");
    setTeacherSignature("");
    setPrincipalSignature("");
    setParentSignature("");

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.selectedStudentId;
      if (baseInfo.studentName) delete next.studentName;
      if (baseInfo.fatherName) delete next.fatherName;
      if (baseInfo.className) delete next.className;
      if (baseInfo.rollNo) delete next.rollNo;
      if (baseInfo.age) delete next.age;
      if (baseInfo.academicYear) delete next.academicYear;
      if (baseInfo.term) delete next.term;
      if (resolvedPicture) delete next.picturePath;
      return next;
    });
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesStudent = selectedStudentId ? String(item.student_id) === String(selectedStudentId) : true;
      const matchesClass = selectedClass ? String(item.class_name || "").trim().toLowerCase() === selectedClass.trim().toLowerCase() : true;
      const matchesYear = academicYear.trim() ? String(item.academic_year || "").trim().toLowerCase() === academicYear.trim().toLowerCase() : true;
      const matchesTerm = term.trim() ? String(item.term || "").trim().toLowerCase() === term.trim().toLowerCase() : true;
      const matchesStatus = selectedStatus.trim() ? String(item.status || "").trim().toUpperCase() === selectedStatus.trim().toUpperCase() : true;
      return matchesStudent && matchesClass && matchesYear && matchesTerm && matchesStatus;
    });
  }, [items, selectedClass, selectedStudentId, academicYear, term, selectedStatus]);

  useEffect(() => {
    setReportPage(1);
  }, [selectedClass, selectedStudentId, academicYear, term, selectedStatus, items]);

  function updateResponse(key, field, value) {
    setResponses((current) => ({
      ...current,
      [key]: { ...(current[key] || {}), [field]: value },
    }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      delete next[`${key}:mt`];
      delete next[`${key}:ft`];
      return next;
    });
    if (message) setMessage("");
  }

  function updateStudentInfo(field, value) {
    setStudentInfo((current) => ({ ...current, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    if (message) setMessage("");
  }

  async function uploadPhotoFile(file, studentId) {
    if (!file) return "";
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", "child_photograph");
      formData.append("applicationId", studentId || "ecce-student");
      const res = await fetch("/api/public/admission-file-upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data?.storedPath) {
        pendingPhotoFileRef.current = null;
        updateStudentInfo("picturePath", data.storedPath);
        return data.storedPath;
      }
    } catch {
      // preserve uploadedPhotoPreview if background upload fails
    } finally {
      setUploadingPhoto(false);
    }
    return "";
  }

  function handlePictureSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image for the student picture.");
      return;
    }
    pendingPhotoFileRef.current = file;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      setUploadedPhotoPreview(dataUrl);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.picturePath;
        return next;
      });
      if (message) setMessage("");
      await uploadPhotoFile(file, selectedStudentId);
    };
    reader.readAsDataURL(file);
  }

  function validateStep(stepIndex) {
    const step = teacherSteps[stepIndex];
    if (!step) return true;
    const newErrors = {};

    if (step.type === "student") {
      if (!selectedStudentId) {
        newErrors.selectedStudentId = "Please select a student from the dropdown";
      }
      for (const field of STUDENT_INFO_REQUIRED_FIELDS) {
        if (!String(studentInfo[field] || "").trim()) {
          if (field === "picturePath") {
            if (!studentInfo.picturePath && !selectedStudent?.profile_picture_path) {
              newErrors.picturePath = "Student picture is required";
            }
          } else if (field === "attendanceTd") {
            newErrors.attendanceTd = "TD is required";
          } else if (field === "attendancePd") {
            newErrors.attendancePd = "PD is required";
          } else {
            newErrors[field] = "This field is required";
          }
        }
      }
      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        setMessage("Please fill in all required fields below before proceeding.");
        return false;
      }
      return true;
    }

    if (step.type === "section" && step.section) {
      const criteria = getSectionCriteria(step.section);
      for (let i = 0; i < criteria.length; i++) {
        const criterion = criteria[i];
        const key = responseKey(step.section, criterion);
        const row = responses[key] || {};
        const mt = String(row.mt || "").trim();
        const ft = String(row.ft || "").trim();
        if (!mt && !ft) {
          newErrors[key] = "Required";
        }
      }
      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        setMessage(`Please select at least one rating (MT or FT) for all criteria in "${step.section.title_en}".`);
        return false;
      }
      return true;
    }

    if (step.type === "performance") {
      subjectPerformance.forEach((row, index) => {
        if (!String(row.performance || row.midPerformance || "").trim()) {
          newErrors[`subject:${index}`] = "Required";
        }
      });
      if (!String(teacherRemarks || "").trim()) {
        newErrors.teacherRemarks = "Required";
      }
      if (!String(principalRemarks || "").trim()) {
        newErrors.principalRemarks = "Required";
      }
      if (!String(parentRemarks || "").trim()) {
        newErrors.parentRemarks = "Required";
      }
      if (!String(teacherSignature || "").trim()) {
        newErrors.teacherSignature = "Required";
      }
      if (!String(principalSignature || "").trim()) {
        newErrors.principalSignature = "Required";
      }
      if (!String(parentSignature || "").trim()) {
        newErrors.parentSignature = "Required";
      }
      if (Object.keys(newErrors).length > 0) {
        setFieldErrors(newErrors);
        setMessage("Please fill in all required performance ratings, remarks, and signatures before submitting.");
        return false;
      }
      return true;
    }

    return true;
  }

  function clearStepErrors(stepIndex) {
    const step = teacherSteps[stepIndex];
    if (!step) return;
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (step.type === "performance") {
        delete next.teacherRemarks;
        delete next.principalRemarks;
        delete next.parentRemarks;
        delete next.teacherSignature;
        delete next.principalSignature;
        delete next.parentSignature;
        for (let i = 0; i < 30; i++) {
          delete next[`subject:${i}`];
        }
      } else if (step.type === "section" && step.section) {
        const criteria = getSectionCriteria(step.section);
        criteria.forEach((criterion) => {
          const key = responseKey(step.section, criterion);
          delete next[key];
          delete next[`${key}:mt`];
          delete next[`${key}:ft`];
        });
      }
      return next;
    });
  }

  function handleNextStep() {
    if (!validateStep(activeTeacherStep)) {
      return;
    }
    setMessage("");
    setFieldErrors({});
    setActiveTeacherStep((current) => Math.min(teacherSteps.length - 1, current + 1));
  }

  function handleStepSelect(targetIndex) {
    setMessage("");
    setFieldErrors({});
    setActiveTeacherStep(targetIndex);
  }

  function resetForm() {
    setEditingAssessmentId(null);
    setUploadedPhotoPreview("");
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem("ecce_prefill_assessment");
      } catch { }
    }
    setEcceMemoryPrefill(null);
    setSelectedStudentId("");
    setSelectedClass("");
    setStudentInfo(buildStudentInfo(null, academicYear, term));
    setResponses(normalizeResponses(sections));
    setSubjectPerformance(
      subjects.map((subject) => ({
        subject,
        performance: "",
        midPerformance: "",
        midRemarks: "",
        finalPerformance: "",
        finalRemarks: "",
      }))
    );
    setTeacherRemarks("");
    setPrincipalRemarks("");
    setParentRemarks("");
    setTeacherSignature("");
    setPrincipalSignature("");
    setParentSignature("");
    setActiveTeacherStep(0);
    setFieldErrors({});
  }

  async function submitAssessment(event) {
    if (event) event.preventDefault();
    if (activeTeacherStep < teacherSteps.length - 1) {
      handleNextStep();
      return;
    }
    setMessage("");
    setFieldErrors({});
    if (!selectedStudentId) {
      setMessage("Please select a student from the dropdown above before submitting.");
      setFieldErrors({ selectedStudentId: "Please select a student from the dropdown" });
      setActiveTeacherStep(0);
      return;
    }
    if (!studentInfo.term && !term) {
      setMessage("Please select a term before submitting.");
      setFieldErrors({ term: "Please select a term" });
      setActiveTeacherStep(0);
      return;
    }
    for (let i = 0; i < teacherSteps.length; i++) {
      if (!validateStep(i)) {
        setActiveTeacherStep(i);
        return;
      }
    }
    setSaving(true);
    setActionLoadingKey("submit-form");
    setMessage("");
    try {
      let finalPicturePath = studentInfo.picturePath || "";
      if (pendingPhotoFileRef.current) {
        const uploadedPath = await uploadPhotoFile(pendingPhotoFileRef.current, selectedStudentId);
        if (uploadedPath) {
          finalPicturePath = uploadedPath;
        }
      }

      const canonicalPath = extractStoragePath(finalPicturePath);
      if (canonicalPath) {
        finalPicturePath = canonicalPath;
      }

      const response = await fetch("/api/ecce-assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          courseId: selectedStudent?.course_id || "",
          academicYear: studentInfo.academicYear || academicYear,
          term: studentInfo.term || term,
          responses: {
            ...responses,
            __studentInfo: {
              ...studentInfo,
              picturePath: finalPicturePath,
            },
            __remarks: {
              teacher: teacherRemarks,
              principal: principalRemarks,
              parents: parentRemarks,
            },
            __signatures: {
              teacher: teacherSignature,
              principal: principalSignature,
              parents: parentSignature,
            },
          },
          subjectPerformance,
          teacherRemarks,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to submit assessment.");
      setMessage("");
      triggerSuccessToast(data.message || "Assessment submitted successfully.", "Assessment Submitted");
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
      setEcceMemoryPrefill(null);
      resetForm();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      router.refresh();
      await loadData(false, "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit assessment.");
    } finally {
      setSaving(false);
      setActionLoadingKey("");
    }
  }

  async function submitCorrectionRequest(event) {
    if (event) event.preventDefault();
    const comment = String(correctionComment || "").trim();
    if (!comment) {
      setCorrectionError("Please enter coordinator comments or a correction reason before requesting correction.");
      return;
    }
    if (!correctionModalItem?.id) return;

    setSaving(true);
    setActionLoadingKey(`${correctionModalItem.id}:correction`);
    setCorrectionError("");
    try {
      const response = await fetch("/api/ecce-assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: correctionModalItem.id, action: "correction", comments: comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update assessment.");
      setMessage("");
      triggerSuccessToast(data.message || "Assessment returned to teacher for correction.", "Correction Requested");
      setCorrectionModalItem(null);
      setCorrectionComment("");
      await loadData();
    } catch (error) {
      setCorrectionError(error instanceof Error ? error.message : "Unable to update assessment.");
    } finally {
      setSaving(false);
      setActionLoadingKey("");
    }
  }

  async function reviewAssessment(id, action) {
    const comment = String(reviewComments[id] || "").trim();
    setSaving(true);
    setActionLoadingKey(`${id}:${action}`);
    setMessage("");
    try {
      const response = await fetch("/api/ecce-assessments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, comments: comment }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update assessment.");
      setMessage("");
      triggerSuccessToast(
        data.message || (action === "approve" ? "Assessment approved successfully." : "Assessment updated."),
        action === "approve" ? "Assessment Approved" : "Assessment Updated"
      );
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update assessment.");
    } finally {
      setSaving(false);
      setActionLoadingKey("");
    }
  }

  async function downloadReport(item) {
    try {
      setDownloadingId(item.id);
      const student = students.find((row) => String(row.id) === String(item.student_id)) || {};
      await downloadAssessmentPdf({ ...student, ...item }, sections);
    } catch (err) {
      console.error("Failed to download PDF:", err);
      setMessage("Failed to download assessment PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  function handleEditAssessment(item) {
    if (!item) return;
    setEditingAssessmentId(item.id || null);
    setEcceMemoryPrefill(item);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("ecce_prefill_assessment", JSON.stringify({ item, timestamp: Date.now() }));
      } catch { }
    }
    if (showTeacherForm) {
      if (item.class_name) setSelectedClass(item.class_name);
      if (item.student_id) setSelectedStudentId(item.student_id);
      if (item.academic_year) setAcademicYear(item.academic_year);
      if (item.term) setTerm(item.term);
      const parsedResponses = typeof item.responses === "string" ? JSON.parse(item.responses) : (item.responses || {});
      const sInfo = parsedResponses?.__studentInfo || {};
      const rem = parsedResponses?.__remarks || {};
      const sig = parsedResponses?.__signatures || {};
      setStudentInfo({
        studentName: sInfo.studentName || item.student_name || "",
        fatherName: sInfo.fatherName || item.father_name || "",
        className: sInfo.className || item.class_name || "",
        rollNo: sInfo.rollNo || item.admission_no || "",
        age: sInfo.age || item.age || dateInputValue(item.date_of_birth) || "",
        academicYear: item.academic_year || sInfo.academicYear || academicYear,
        term: item.term || sInfo.term || term,
        picturePath: sInfo.picturePath || item.profile_picture_url || item.profile_picture_path || "",
        attendanceTd: sInfo.attendanceTd || (item.attendance?.total ? String(item.attendance.total) : ""),
        attendancePd: sInfo.attendancePd || (item.attendance?.present ? String(item.attendance.present) : ""),
      });
      setResponses({
        ...normalizeResponses(sections),
        ...parsedResponses,
      });
      const rawSubjectPerf = typeof item.subject_performance === "string" ? JSON.parse(item.subject_performance) : (item.subject_performance || []);
      if (Array.isArray(rawSubjectPerf) && rawSubjectPerf.length > 0) {
        setSubjectPerformance(rawSubjectPerf.map((p) => ({ ...p, subject: p.subject === "دینی" ? "فہمِ دین" : p.subject })));
      } else {
        setSubjectPerformance(subjects.map((s) => ({ subject: s, performance: "", midPerformance: "", midRemarks: "", finalPerformance: "", finalRemarks: "" })));
      }
      setTeacherRemarks(rem.teacher || item.teacher_remarks || "");
      setPrincipalRemarks(rem.principal || "");
      setParentRemarks(rem.parents || "");
      setTeacherSignature(sig.teacher || "");
      setPrincipalSignature(sig.principal || "");
      setParentSignature(sig.parents || "");
      setActiveTeacherStep(0);
      setFieldErrors({});
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      router.push(`/teacher/ecce-assessments?studentId=${item.student_id}&assessmentId=${item.id || ""}&academicYear=${encodeURIComponent(item.academic_year || "")}&term=${encodeURIComponent(item.term || "")}`);
    }
  }

  const PAGE_SIZE = 7;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentReportPage = Math.min(Math.max(1, reportPage), totalPages);
  const startItem = filteredItems.length === 0 ? 0 : (currentReportPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentReportPage * PAGE_SIZE, filteredItems.length);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentReportPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, currentReportPage]);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).slice(
    Math.max(0, currentReportPage - 2),
    Math.max(0, currentReportPage - 2) + 5
  );

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Themed Top-Right Success Toast Notification */}
      {successToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-5 top-5 z-[10000] flex w-[calc(100vw-2.5rem)] max-w-md items-start gap-3.5 overflow-hidden rounded-2xl border-2 border-[#C79A3B]/50 bg-[linear-gradient(135deg,#FFFFFF_0%,#FAF7F0_100%)] p-4 text-[#063F32] shadow-[0_20px_60px_-15px_rgba(15,76,58,0.28),0_0_25px_rgba(199,154,59,0.18)] backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0F4C3A_0%,#C79A3B_50%,#0F4C3A_100%)]" />
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F4C3A] text-[#E4C766] shadow-[0_4px_12px_rgba(15,76,58,0.3)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pr-1">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C79A3B]">
              {successToast.title || "Success"}
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-[#063F32]">
              {successToast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="shrink-0 rounded-lg p-1.5 text-[#0F4C3A]/60 transition hover:bg-[#0F4C3A]/10 hover:text-[#0F4C3A]"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,#0F4C3A_0%,#0B3D30_100%)] p-8 text-white shadow-[0_24px_70px_-35px_rgba(15,76,58,.8)]">
        <p className="text-xs font-black uppercase tracking-[0.35em] text-[#E4C766]">ECCE Assessment</p>
        <h1 className="mt-3 text-3xl font-black">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold text-white/85">{description}</p>
      </section>

      {message ? (
        <div className="rounded-[1.25rem] border border-[#C79A3B]/30 bg-[#FFF8E4] px-5 py-4 text-sm font-bold text-[#0F4C3A]">
          {message}
        </div>
      ) : null}

      <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white/90 p-6 shadow-[0_20px_70px_-42px_rgba(13,59,46,.35)]">
        <div className={filterGridClass}>
          {(isManager || isTeacher) ? (
            <label className="text-sm font-bold text-[#063F32]">
              Class
              <ThemedSelect
                className="mt-2"
                value={selectedClass}
                onChange={(event) => {
                  setSelectedClass(event.target.value);
                  handleStudentChange("");
                }}
              >
                <option value="">All classes</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>{className}</option>
                ))}
              </ThemedSelect>
            </label>
          ) : null}
          <label className="text-sm font-bold text-[#063F32]">
            Student
            <ThemedSelect
              className="mt-2"
              value={selectedStudentId}
              onChange={(event) => handleStudentChange(event.target.value)}
            >
              <option value="">All students</option>
              {studentOptions.map((student) => (
                <option key={student.id} value={student.id}>{student.student_name || "Unnamed student"}</option>
              ))}
            </ThemedSelect>
            {fieldErrors.selectedStudentId ? (
              <p className="mt-1 text-xs text-rose-600 font-normal">
                {fieldErrors.selectedStudentId}
              </p>
            ) : null}
          </label>
          <label className="text-sm font-bold text-[#063F32]">
            Academic Year
            {canShowReports ? (
              <ThemedSelect
                className="mt-2"
                value={academicYear}
                onChange={(event) => {
                  const val = event.target.value;
                  setAcademicYear(val);
                  setStudentInfo((curr) => ({ ...curr, academicYear: val }));
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    if (val.trim()) delete next.academicYear;
                    return next;
                  });
                  if (message) setMessage("");
                }}
              >
                <option value="">All academic years</option>
                {academicYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </ThemedSelect>
            ) : (
              <input
                className={`${inputClass} mt-2`}
                placeholder="Academic year (e.g. 2026)"
                value={academicYear}
                onChange={(event) => {
                  const val = event.target.value;
                  setAcademicYear(val);
                  setStudentInfo((curr) => ({ ...curr, academicYear: val }));
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    if (val.trim()) delete next.academicYear;
                    return next;
                  });
                  if (message) setMessage("");
                }}
              />
            )}
          </label>
          <label className="text-sm font-bold text-[#063F32]">
            Term
            <ThemedSelect
              className="mt-2"
              value={term}
              onChange={(event) => {
                const val = event.target.value;
                setTerm(val);
                setStudentInfo((curr) => ({ ...curr, term: val }));
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  if (val.trim()) delete next.term;
                  return next;
                });
                if (message) setMessage("");
              }}
            >
              <option value="">All terms</option>
              {termOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            </ThemedSelect>
          </label>
          {canShowReports ? (
            <label className="text-sm font-bold text-[#063F32]">
              Status
              <ThemedSelect
                className="mt-2"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </ThemedSelect>
            </label>
          ) : null}
        </div>
      </section>

      {canShowTeacherForm ? (
        <form
          onSubmit={submitAssessment}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.target?.tagName === "INPUT") {
              event.preventDefault();
            }
          }}
          className="space-y-6 rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-6"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#C79A3B]">
                  {editingAssessmentId ? "✏️ Editing Mode Active" : "Teacher entry"}
                </p>
                <h2 className="mt-2 text-2xl font-black text-[#063F32]">
                  {editingAssessmentId ? "Edit Assessment Form" : "Assessment Form"}
                </h2>
              </div>
              {editingAssessmentId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#C79A3B] bg-[#FFF8E4] px-4 py-2 text-xs font-black text-[#0F4C3A] shadow-sm transition hover:bg-[#FAF7F0]"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel Edit</span>
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-semibold text-[#245C4F]">
              {editingAssessmentId
                ? `Prefilled with saved data for ${studentInfo.studentName || "the selected student"}. Make your changes and submit to update.`
                : "Complete one section at a time. All visible criteria require at least one rating (MT or FT) before submission."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-4">
            <div ref={stepTabsContainerRef} className="flex gap-2 overflow-x-auto pb-1 scroll-smooth">
              {teacherSteps.map((step, index) => (
                <button
                  key={step.key}
                  ref={(el) => { stepTabRefs.current[index] = el; }}
                  type="button"
                  onClick={() => handleStepSelect(index)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${index === activeTeacherStep
                    ? "bg-[#0F4C3A] text-white shadow-[0_12px_26px_-18px_rgba(15,76,58,.9)]"
                    : "border border-[#2D8A6A]/15 bg-[#FAF7F0] text-[#245C4F] hover:border-[#C79A3B]/60"
                    }`}
                >
                  {index + 1}. {step.label}
                </button>
              ))}
            </div>
          </div>

          <section className="rounded-[1.5rem] border border-[#2D8A6A]/15 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#C79A3B]">
                  Section {activeTeacherStep + 1} of {teacherSteps.length || 1}
                </p>
                <h3 className="mt-2 text-xl font-black text-[#063F32]">
                  {activeTeacherStepItem?.type === "section"
                    ? mainHeadingForSection(activeTeacherStepItem.section)
                    : activeTeacherStepItem?.type === "performance"
                      ? `Subject Wise Performance (${studentInfo.term || term || "Selected Term"})`
                      : activeTeacherStepItem?.label || "Assessment"}
                </h3>
                {activeTeacherStepItem?.type === "section" ? (
                  <div className="mt-2 grid gap-1 md:grid-cols-[1fr_auto] md:items-end">
                    <p className="text-sm font-black text-[#245C4F]">({activeTeacherStepItem.section?.title_en || "-"})</p>
                    {activeTeacherStepItem.section?.title_ur ? (
                      <p className="font-['Noto_Nastaliq_Urdu',serif] text-right text-lg font-black text-[#063F32]" dir="rtl">
                        {activeTeacherStepItem.section.title_ur}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {activeTeacherStepItem?.type === "student" ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
                <label className="relative block cursor-pointer rounded-[1.25rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 transition hover:border-[#C79A3B]/60">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePictureSelect} />
                  {selectedStudentPhoto ? (
                    <div className="relative h-48 w-full overflow-hidden rounded-[1rem] bg-[#EFECE4] flex items-center justify-center border border-[#2D8A6A]/15">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedStudentPhoto}
                        alt={studentInfo.studentName || "Student"}
                        className="h-full w-full object-cover"
                      />
                      {uploadingPhoto ? (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/45 text-white backdrop-blur-[2px]">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#C79A3B]" />
                          <span className="mt-1.5 text-xs font-bold text-white">Uploading picture...</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative flex h-48 items-center justify-center rounded-[1rem] border border-dashed border-[#2D8A6A]/25 text-sm font-bold text-[#245C4F]">
                      {uploadingPhoto ? (
                        <div className="flex flex-col items-center justify-center text-center">
                          <RefreshCw className="h-6 w-6 animate-spin text-[#0D5C48]" />
                          <span className="mt-1.5 text-xs font-bold text-[#0F4C3A]">Uploading picture...</span>
                        </div>
                      ) : (
                        "Select student picture"
                      )}
                    </div>
                  )}
                  <p className="mt-3 text-center text-xs font-black uppercase tracking-[0.18em] text-[#0F4C3A]">
                    {uploadingPhoto ? "Uploading..." : "Click to choose picture"}
                  </p>
                  {fieldErrors.picturePath ? (
                    <p className="mt-1 text-center text-xs text-rose-600 font-normal">
                      {fieldErrors.picturePath}
                    </p>
                  ) : null}
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["Student's Name", "studentName"],
                    ["Father Name", "fatherName"],
                    ["Class", "className"],
                    ["Roll #", "rollNo"],
                    ["Age", "age"],
                    ["Academic Year", "academicYear"],
                    ["Term", "term"],
                  ].map(([label, field]) => (
                    <div key={label} className="rounded-[1.25rem] border border-[#E4D8BE] bg-[#FFFCF5] p-4">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-[#C79A3B]">
                        {label}
                        {field === "term" ? (
                          <ThemedSelect
                            className="mt-2"
                            value={studentInfo[field] || ""}
                            onChange={(event) => updateStudentInfo(field, event.target.value)}
                          >
                            <option value="">Select term</option>
                            {terms.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </ThemedSelect>
                        ) : (
                          <input
                            type={field === "age" ? "date" : "text"}
                            className={`${inputClass} mt-2`}
                            placeholder={field === "academicYear" ? "e.g. 2026" : ""}
                            value={studentInfo[field] || ""}
                            onChange={(event) => updateStudentInfo(field, event.target.value)}
                          />
                        )}
                      </label>
                      {fieldErrors[field] ? (
                        <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors[field]}</p>
                      ) : null}
                    </div>
                  ))}
                  <div className="rounded-[1.25rem] border border-[#E4D8BE] bg-[#FFFCF5] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#C79A3B]">
                      Attendance ({studentInfo.term || term || "Selected Term"})
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-[#245C4F]">
                          TD
                          <input
                            className={`${inputClass} mt-1 px-3 py-2`}
                            value={studentInfo.attendanceTd || ""}
                            onChange={(event) => updateStudentInfo("attendanceTd", event.target.value)}
                          />
                        </label>
                        {fieldErrors.attendanceTd ? (
                          <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.attendanceTd}</p>
                        ) : null}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-[#245C4F]">
                          PD
                          <input
                            className={`${inputClass} mt-1 px-3 py-2`}
                            value={studentInfo.attendancePd || ""}
                            onChange={(event) => updateStudentInfo("attendancePd", event.target.value)}
                          />
                        </label>
                        {fieldErrors.attendancePd ? (
                          <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.attendancePd}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTeacherStepItem?.type === "section" ? (
              <>
                <div className="mt-3 rounded-[1rem] border border-[#C79A3B]/25 bg-[#FFF8E4] px-3.5 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0F4C3A]">Rating Key</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {ECCE_RATINGS.map((rating) => (
                      <div key={rating.value} className="rounded-[0.75rem] border border-[#C79A3B]/15 bg-white px-2.5 py-1.5 shadow-sm flex flex-col justify-center">
                        <p className="text-xs font-black text-[#0F4C3A] leading-tight">{rating.value}</p>
                        <p className="mt-0.5 text-[11px] font-medium leading-tight text-[#245C4F]">{rating.label.replace(`${rating.value} `, "")}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Desktop 2-column criteria table (>= 901px) */}
                <div className="ecce-desktop-criteria mt-5 overflow-x-auto rounded-[1.25rem] border border-[#E4D8BE] bg-[#FFFCF5]">
                  <table className="min-w-[760px] w-full border-collapse text-sm">
                    <thead className="bg-[#F1EADC] text-[#0F4C3A]">
                      {activeTeacherStepItem.section?.key === "mathematical_development" ? (
                        <tr>
                          <th className="w-[34%] px-3 py-3 text-left font-black">Assessment Criteria</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">FT</th>
                          <th className="w-[34%] border-l border-[#D8C79F] px-3 py-3 text-left font-black">Assessment Criteria</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">FT</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">FT</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="w-[34%] px-3 py-3 text-right font-['Noto_Nastaliq_Urdu',serif] text-base" dir="rtl">
                            {activeTeacherStepItem.section?.key === "physical_development"
                              ? "کثیف جسمانی صلاحیتیں (Gross Motor Skills)"
                              : "جائزے کے اہداف"}
                          </th>
                          <th className="w-[8%] border-l border-[#D8C79F] px-1.5 py-3 text-center font-black">FT</th>
                          <th className="w-[8%] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="w-[34%] px-3 py-3 text-right font-['Noto_Nastaliq_Urdu',serif] text-base" dir="rtl">
                            {activeTeacherStepItem.section?.key === "physical_development"
                              ? "لطیف جسمانی صلاحیتیں (Fine Motor Skills)"
                              : "جائزے کے اہداف"}
                          </th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {pairCriteria(getSectionCriteria(activeTeacherStepItem.section)).map(([left, right], index) => {
                        const leftKey = left ? responseKey(activeTeacherStepItem.section, left) : "";
                        const rightKey = right ? responseKey(activeTeacherStepItem.section, right) : "";
                        const isMath = activeTeacherStepItem.section?.key === "mathematical_development";

                        if (isMath) {
                          return (
                            <tr key={`${activeTeacherStepItem.section?.key || "section"}-${index}`} className="border-t border-[#E4D8BE]">
                              <td className="px-3 py-2 text-left font-bold text-sm text-[#063F32] align-top">
                                {left ? labelForSectionCriterion(activeTeacherStepItem.section, left) : ""}
                                {left && fieldErrors[leftKey] ? (
                                  <p className="mt-0.5 text-xs text-rose-600 font-normal">Required (select MT or FT)</p>
                                ) : null}
                              </td>
                              <td className="px-1.5 py-2 align-top">
                                {left ? (
                                  <ThemedSelect
                                    className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                    value={responses[leftKey]?.mt || ""}
                                    onChange={(event) => updateResponse(leftKey, "mt", event.target.value)}
                                  >
                                    <option value="">MT</option>
                                    {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                  </ThemedSelect>
                                ) : null}
                              </td>
                              <td className="px-1.5 py-2 align-top">
                                {left ? (
                                  <ThemedSelect
                                    className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                    value={responses[leftKey]?.ft || ""}
                                    onChange={(event) => updateResponse(leftKey, "ft", event.target.value)}
                                  >
                                    <option value="">FT</option>
                                    {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                  </ThemedSelect>
                                ) : null}
                              </td>
                              <td className="border-l border-[#D8C79F] px-3 py-2 text-left font-bold text-sm text-[#063F32] align-top">
                                {right ? labelForSectionCriterion(activeTeacherStepItem.section, right) : ""}
                                {right && fieldErrors[rightKey] ? (
                                  <p className="mt-0.5 text-xs text-rose-600 font-normal">Required (select MT or FT)</p>
                                ) : null}
                              </td>
                              <td className="px-1.5 py-2 align-top">
                                {right ? (
                                  <ThemedSelect
                                    className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                    value={responses[rightKey]?.mt || ""}
                                    onChange={(event) => updateResponse(rightKey, "mt", event.target.value)}
                                  >
                                    <option value="">MT</option>
                                    {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                  </ThemedSelect>
                                ) : null}
                              </td>
                              <td className="px-1.5 py-2 align-top">
                                {right ? (
                                  <ThemedSelect
                                    className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                    value={responses[rightKey]?.ft || ""}
                                    onChange={(event) => updateResponse(rightKey, "ft", event.target.value)}
                                  >
                                    <option value="">FT</option>
                                    {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                  </ThemedSelect>
                                ) : null}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={`${activeTeacherStepItem.section?.key || "section"}-${index}`} className="border-t border-[#E4D8BE]">
                            <td className="px-1.5 py-2 align-top">
                              {left ? (
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[leftKey]?.ft || ""}
                                  onChange={(event) => updateResponse(leftKey, "ft", event.target.value)}
                                >
                                  <option value="">FT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              ) : null}
                            </td>
                            <td className="px-1.5 py-2 align-top">
                              {left ? (
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[leftKey]?.mt || ""}
                                  onChange={(event) => updateResponse(leftKey, "mt", event.target.value)}
                                >
                                  <option value="">MT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              ) : null}
                            </td>
                            <td className={`${left?.language === "ur" ? "font-['Noto_Nastaliq_Urdu',serif]" : ""} px-3 py-2 text-right font-bold leading-8 text-[#063F32] align-top`} dir={left?.language === "ur" ? "rtl" : "ltr"}>
                              {left ? labelForSectionCriterion(activeTeacherStepItem.section, left) : ""}
                              {left && fieldErrors[leftKey] ? (
                                <p className="mt-0.5 text-xs text-rose-600 font-normal font-sans text-right" dir="ltr">Required (select MT or FT)</p>
                              ) : null}
                            </td>
                            <td className="border-l border-[#D8C79F] px-1.5 py-2 align-top">
                              {right ? (
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[rightKey]?.ft || ""}
                                  onChange={(event) => updateResponse(rightKey, "ft", event.target.value)}
                                >
                                  <option value="">FT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              ) : null}
                            </td>
                            <td className="px-1.5 py-2 align-top">
                              {right ? (
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[rightKey]?.mt || ""}
                                  onChange={(event) => updateResponse(rightKey, "mt", event.target.value)}
                                >
                                  <option value="">MT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              ) : null}
                            </td>
                            <td className={`${right?.language === "ur" ? "font-['Noto_Nastaliq_Urdu',serif]" : ""} px-3 py-2 text-right font-bold leading-8 text-[#063F32] align-top`} dir={right?.language === "ur" ? "rtl" : "ltr"}>
                              {right ? labelForSectionCriterion(activeTeacherStepItem.section, right) : ""}
                              {right && fieldErrors[rightKey] ? (
                                <p className="mt-0.5 text-xs text-rose-600 font-normal font-sans text-right" dir="ltr">Required (select MT or FT)</p>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile/Tablet 1-column criteria table (< 901px) */}
                <div className="ecce-mobile-criteria mt-5 overflow-x-auto rounded-[1.25rem] border border-[#E4D8BE] bg-[#FFFCF5]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-[#F1EADC] text-[#0F4C3A]">
                      {activeTeacherStepItem.section?.key === "mathematical_development" ? (
                        <tr>
                          <th className="px-3 py-3 text-left font-black">Assessment Criteria</th>
                          <th className="w-[84px] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="w-[84px] px-1.5 py-3 text-center font-black">FT</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="w-[84px] px-1.5 py-3 text-center font-black">FT</th>
                          <th className="w-[84px] px-1.5 py-3 text-center font-black">MT</th>
                          <th className="px-3 py-3 text-right font-['Noto_Nastaliq_Urdu',serif] text-base" dir="rtl">
                            جائزے کے اہداف
                          </th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {getSectionCriteria(activeTeacherStepItem.section).map((criterion, index) => {
                        const key = criterion ? responseKey(activeTeacherStepItem.section, criterion) : "";
                        const isMath = activeTeacherStepItem.section?.key === "mathematical_development";

                        if (isMath) {
                          return (
                            <tr key={`mobile-${activeTeacherStepItem.section?.key || "section"}-${index}`} className="border-t border-[#E4D8BE]">
                              <td className="px-3 py-2 text-left font-bold text-sm text-[#063F32] align-top">
                                {labelForSectionCriterion(activeTeacherStepItem.section, criterion)}
                                {fieldErrors[key] ? (
                                  <p className="mt-0.5 text-xs text-rose-600 font-normal">Required (select MT or FT)</p>
                                ) : null}
                              </td>
                              <td className="w-[84px] px-1.5 py-2 align-top">
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[key]?.mt || ""}
                                  onChange={(event) => updateResponse(key, "mt", event.target.value)}
                                >
                                  <option value="">MT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              </td>
                              <td className="w-[84px] px-1.5 py-2 align-top">
                                <ThemedSelect
                                  className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                  value={responses[key]?.ft || ""}
                                  onChange={(event) => updateResponse(key, "ft", event.target.value)}
                                >
                                  <option value="">FT</option>
                                  {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                                </ThemedSelect>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={`mobile-${activeTeacherStepItem.section?.key || "section"}-${index}`} className="border-t border-[#E4D8BE]">
                            <td className="w-[84px] px-1.5 py-2 align-top">
                              <ThemedSelect
                                className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                value={responses[key]?.ft || ""}
                                onChange={(event) => updateResponse(key, "ft", event.target.value)}
                              >
                                <option value="">FT</option>
                                {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                              </ThemedSelect>
                            </td>
                            <td className="w-[84px] px-1.5 py-2 align-top">
                              <ThemedSelect
                                className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7"
                                value={responses[key]?.mt || ""}
                                onChange={(event) => updateResponse(key, "mt", event.target.value)}
                              >
                                <option value="">MT</option>
                                {ECCE_RATINGS.map((rating) => <option key={rating.value} value={rating.value}>{rating.value}</option>)}
                              </ThemedSelect>
                            </td>
                            <td className={`${criterion?.language === "ur" ? "font-['Noto_Nastaliq_Urdu',serif]" : ""} px-3 py-2 text-right font-bold leading-8 text-[#063F32] align-top`} dir={criterion?.language === "ur" ? "rtl" : "ltr"}>
                              {labelForSectionCriterion(activeTeacherStepItem.section, criterion)}
                              {fieldErrors[key] ? (
                                <p className="mt-0.5 text-xs text-rose-600 font-normal font-sans text-right" dir="ltr">Required (select MT or FT)</p>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {activeTeacherStepItem?.type === "performance" ? (
              <>
                <div className="mt-3 rounded-[1rem] border border-[#C79A3B]/25 bg-[#FFF8E4] px-3.5 py-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0F4C3A]">Rating Key</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {ECCE_RATINGS.map((rating) => (
                      <div key={rating.value} className="rounded-[0.75rem] border border-[#C79A3B]/15 bg-white px-2.5 py-1.5 shadow-sm flex flex-col justify-center">
                        <p className="text-xs font-black text-[#0F4C3A] leading-tight">{rating.value}</p>
                        <p className="mt-0.5 text-[11px] font-medium leading-tight text-[#245C4F]">{rating.label.replace(`${rating.value} `, "")}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto rounded-[1.25rem] border border-[#E4D8BE] bg-[#FFFCF5]">
                  <table className="min-w-[800px] w-full border-collapse text-sm">
                    <thead className="bg-[#F1EADC] text-[#0F4C3A]">
                      <tr>
                        <th rowSpan={2} className="w-[18%] border border-[#E4D8BE] px-4 py-3 text-center font-black text-sm text-[#0F4C3A]">
                          Subjects
                        </th>
                        <th rowSpan={2} className="w-[18%] border border-[#E4D8BE] px-4 py-3 text-center font-black text-sm text-[#0F4C3A]">
                          Performance
                        </th>
                        <th colSpan={3} className="border border-[#E4D8BE] px-4 py-2.5 text-center font-black text-sm text-[#0F4C3A]">
                          Remarks
                        </th>
                      </tr>
                      <tr>
                        <th className="w-[21%] border border-[#E4D8BE] px-3 py-2 text-center font-black text-sm text-[#0F4C3A]">
                          Teacher.
                        </th>
                        <th className="w-[21%] border border-[#E4D8BE] px-3 py-2 text-center font-black text-sm text-[#0F4C3A]">
                          Principal
                        </th>
                        <th className="w-[22%] border border-[#E4D8BE] px-3 py-2 text-center font-black text-sm text-[#0F4C3A]">
                          Parents
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectPerformance.map((row, index) => {
                        const displaySubject = row.subject === "دینی" ? "فہمِ دین" : row.subject;
                        return (
                          <tr key={displaySubject || index} className="border-b border-[#E4D8BE]">
                            <td className="border border-[#E4D8BE] px-4 py-2.5 text-center font-bold text-[#063F32] bg-[#FFFCF5]">
                              <span className={displaySubject === "فہمِ دین" ? "font-['Noto_Nastaliq_Urdu',serif] text-base" : "text-sm"}>
                                {displaySubject}
                              </span>
                            </td>
                            <td className="border border-[#E4D8BE] px-2 py-2 bg-[#FFFCF5] align-top">
                              <ThemedSelect
                                className="[&_select]:px-2 [&_select]:py-2 [&_select]:pr-7 text-xs"
                                value={row.performance || row.midPerformance || ""}
                                onChange={(event) => {
                                  const val = event.target.value;
                                  setSubjectPerformance((current) => current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, subject: displaySubject, performance: val, midPerformance: val }
                                      : item
                                  ));
                                  setFieldErrors((prev) => {
                                    const next = { ...prev };
                                    delete next[`subject:${index}`];
                                    return next;
                                  });
                                  if (message) setMessage("");
                                }}
                              >
                                <option value="">Select</option>
                                {ECCE_RATINGS.map((rating) => (
                                  <option key={rating.value} value={rating.value}>{rating.value}</option>
                                ))}
                              </ThemedSelect>
                              {fieldErrors[`subject:${index}`] ? (
                                <p className="mt-0.5 text-[10px] text-rose-600 font-normal text-center">Required</p>
                              ) : null}
                            </td>
                            {index === 0 ? (
                              <>
                                <td rowSpan={subjectPerformance.length} className="border border-[#E4D8BE] p-2 align-top bg-white">
                                  <textarea
                                    className={`${inputClass} h-full min-h-[260px] w-full resize-none p-3`}
                                    placeholder="Teacher remarks..."
                                    value={teacherRemarks}
                                    onChange={(event) => {
                                      setTeacherRemarks(event.target.value);
                                      setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next.teacherRemarks;
                                        return next;
                                      });
                                      if (message) setMessage("");
                                    }}
                                  />
                                  {fieldErrors.teacherRemarks ? (
                                    <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.teacherRemarks}</p>
                                  ) : null}
                                </td>
                                <td rowSpan={subjectPerformance.length} className="border border-[#E4D8BE] p-2 align-top bg-white">
                                  <textarea
                                    className={`${inputClass} h-full min-h-[260px] w-full resize-none p-3`}
                                    placeholder="Principal remarks..."
                                    value={principalRemarks}
                                    onChange={(event) => {
                                      setPrincipalRemarks(event.target.value);
                                      setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next.principalRemarks;
                                        return next;
                                      });
                                      if (message) setMessage("");
                                    }}
                                  />
                                  {fieldErrors.principalRemarks ? (
                                    <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.principalRemarks}</p>
                                  ) : null}
                                </td>
                                <td rowSpan={subjectPerformance.length} className="border border-[#E4D8BE] p-2 align-top bg-white">
                                  <textarea
                                    className={`${inputClass} h-full min-h-[260px] w-full resize-none p-3`}
                                    placeholder="Parents remarks..."
                                    value={parentRemarks}
                                    onChange={(event) => {
                                      setParentRemarks(event.target.value);
                                      setFieldErrors((prev) => {
                                        const next = { ...prev };
                                        delete next.parentRemarks;
                                        return next;
                                      });
                                      if (message) setMessage("");
                                    }}
                                  />
                                  {fieldErrors.parentRemarks ? (
                                    <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.parentRemarks}</p>
                                  ) : null}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        );
                      })}
                      <tr className="bg-[#F9F6EE]">
                        <td colSpan={2} className="border border-[#E4D8BE] px-4 py-3 font-black text-sm text-[#063F32] text-center">
                          Name & Signature
                        </td>
                        <td className="border border-[#E4D8BE] p-2 bg-white align-top">
                          <input
                            className={`${inputClass} px-3 py-2 text-xs`}
                            placeholder="Teacher Name & Signature"
                            value={teacherSignature}
                            onChange={(event) => {
                              setTeacherSignature(event.target.value);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.teacherSignature;
                                return next;
                              });
                              if (message) setMessage("");
                            }}
                          />
                          {fieldErrors.teacherSignature ? (
                            <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.teacherSignature}</p>
                          ) : null}
                        </td>
                        <td className="border border-[#E4D8BE] p-2 bg-white align-top">
                          <input
                            className={`${inputClass} px-3 py-2 text-xs`}
                            placeholder="Principal Name & Signature"
                            value={principalSignature}
                            onChange={(event) => {
                              setPrincipalSignature(event.target.value);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.principalSignature;
                                return next;
                              });
                              if (message) setMessage("");
                            }}
                          />
                          {fieldErrors.principalSignature ? (
                            <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.principalSignature}</p>
                          ) : null}
                        </td>
                        <td className="border border-[#E4D8BE] p-2 bg-white align-top">
                          <input
                            className={`${inputClass} px-3 py-2 text-xs`}
                            placeholder="Parents Name & Signature"
                            value={parentSignature}
                            onChange={(event) => {
                              setParentSignature(event.target.value);
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.parentSignature;
                                return next;
                              });
                              if (message) setMessage("");
                            }}
                          />
                          {fieldErrors.parentSignature ? (
                            <p className="mt-1 text-xs text-rose-600 font-normal">{fieldErrors.parentSignature}</p>
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                key="btn-prev"
                type="button"
                className={ghostButtonClass}
                disabled={activeTeacherStep <= 0}
                onClick={() => {
                  setMessage("");
                  setFieldErrors({});
                  setActiveTeacherStep((current) => Math.max(0, current - 1));
                }}
              >
                Previous
              </button>
              {activeTeacherStep < teacherSteps.length - 1 ? (
                <button
                  key="btn-next"
                  type="button"
                  className={buttonClass}
                  onClick={handleNextStep}
                >
                  Next
                </button>
              ) : (
                <button
                  key="btn-submit"
                  type="submit"
                  className={`${buttonClass} inline-flex items-center gap-2`}
                  disabled={saving || loading}
                >
                  {saving && actionLoadingKey === "submit-form" ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit assessment</span>
                  )}
                </button>
              )}
            </div>
          </section>
        </form>
      ) : null}

      {canShowReports ? (
        <section className="rounded-[2rem] border border-[#2D8A6A]/15 bg-white p-6 shadow-[0_20px_70px_-42px_rgba(13,59,46,.35)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#C79A3B]">Reports</p>
              <h2 className="mt-2 text-2xl font-black text-[#063F32]">{isReadonly ? "Available Assessment Reports" : "Assessment Review List"}</h2>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#2D8A6A]/20 bg-white px-3.5 py-1.5 text-xs font-bold text-[#0F4C3A] shadow-sm transition hover:border-[#C79A3B]/60 hover:bg-[#FAF7F0] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={loadData}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#0D5C48] ${loading ? "animate-spin" : ""}`} />
              <span>{loading ? "Refreshing..." : "Refresh"}</span>
            </button>
          </div>
          <div className="mt-6 grid gap-4">
            {paginatedItems.length ? paginatedItems.map((item) => (
              <article key={item.id} className="rounded-[1.25rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] p-4 sm:p-5 shadow-xs transition hover:border-[#2D8A6A]/30">
                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="flex flex-col justify-between space-y-3">
                    <div className="flex items-center gap-3.5">
                      {(() => {
                        const studentObj = students.find((s) => String(s.id) === String(item.student_id));
                        const photoUrl =
                          item.profile_picture_url ||
                          (item.profile_picture_path ? buildPreviewUrl(item.profile_picture_path) : "") ||
                          (item.responses?.__studentInfo?.picturePath ? buildPreviewUrl(item.responses.__studentInfo.picturePath) : "") ||
                          studentObj?.profile_picture_url ||
                          (studentObj?.profile_picture_path ? buildPreviewUrl(studentObj.profile_picture_path) : "");
                        return photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoUrl}
                            alt={item.student_name || "Student"}
                            className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-[0.85rem] border-2 border-[#2D8A6A]/25 bg-[#EFECE4] object-cover shadow-xs"
                          />
                        ) : (
                          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-[0.85rem] border-2 border-[#2D8A6A]/25 bg-[#EFECE4] text-base sm:text-lg font-black text-[#0F4C3A] shadow-xs">
                            {(item.student_name || "S").charAt(0).toUpperCase()}
                          </div>
                        );
                      })()}
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg sm:text-xl font-black text-[#063F32] leading-tight">{item.student_name}</h3>
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] shadow-2xs ${
                            item.status === "APPROVED" || item.status === "PUBLISHED"
                              ? "bg-[#0F4C3A] text-white"
                              : item.status === "CORRECTION_REQUIRED"
                                ? "bg-[#FCECEC] text-[#9C2D2D] border border-rose-200"
                                : "bg-[#FFF8E4] border border-[#C79A3B]/40 text-[#854D0E]"
                          }`}>
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-[#245C4F]">{item.class_name || "-"} | {item.term} | {item.academic_year}</p>
                        {item.teacher_name ? <p className="text-xs font-semibold text-[#245C4F]/85">Teacher: {item.teacher_name}</p> : null}
                      </div>
                    </div>

                    {item.returned_reason ? (
                      <div className="rounded-[0.85rem] bg-[#FCECEC] border border-rose-200 px-3 py-2 text-xs font-bold text-[#9C2D2D] max-w-2xl">
                        Correction Reason: {item.returned_reason}
                      </div>
                    ) : null}

                  </div>

                  <div className="shrink-0 flex items-center justify-center lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:justify-end">
                    <AttendancePieChart attendance={item.attendance} />
                  </div>

                  <div className="flex flex-row flex-wrap items-center justify-center gap-2 pt-0.5 lg:justify-start lg:col-start-1 lg:row-start-2">
                    <button
                      className="rounded-full border border-[#2D8A6A]/20 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-[#0F4C3A] transition hover:border-[#C79A3B]/60 whitespace-nowrap shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      disabled={downloadingId === item.id}
  
                      onClick={() => downloadReport(item)}
                    >
                      {downloadingId === item.id ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0D5C48]" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5 text-[#0D5C48]" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                    {isTeacher && (item.status === "CORRECTION_REQUIRED" || item.status === "SUBMITTED") ? (
                      <button
                        className="rounded-full bg-[#0F4C3A] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,76,58,.8)] transition hover:bg-[#0B3D30] whitespace-nowrap"
                        onClick={() => handleEditAssessment(item)}
                      >
                        {item.status === "CORRECTION_REQUIRED" ? "Edit / Correct" : "Edit Assessment"}
                      </button>
                    ) : null}
                    {isManager && item.status === "SUBMITTED" ? (
                      <>
                        <button
                          className="rounded-full bg-[#0F4C3A] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,76,58,.8)] transition hover:bg-[#0B3D30] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-1.5"
                          disabled={saving}
                          onClick={() => reviewAssessment(item.id, "approve")}
                        >
                          {actionLoadingKey === `${item.id}:approve` ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Approving...</span>
                            </>
                          ) : (
                            <span>Approve</span>
                          )}
                        </button>
                        <button
                          className="rounded-full border border-[#2D8A6A]/20 bg-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-[#9C2D2D] transition hover:border-[#9C2D2D]/60 hover:bg-[#FFF5F5] whitespace-nowrap shadow-xs disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-1.5"
                          disabled={saving}
                          onClick={() => {
                            setCorrectionModalItem(item);
                            setCorrectionComment("");
                            setCorrectionError("");
                          }}
                        >
                          <span>Request correction</span>
                        </button>
                      </>
                    ) : null}
                    {isManager && item.status === "APPROVED" ? (
                      <button
                        className="rounded-full bg-[#0F4C3A] px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-white shadow-[0_10px_24px_-14px_rgba(15,76,58,.8)] transition hover:bg-[#0B3D30] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-1.5"
                        disabled={saving}
                        onClick={() => reviewAssessment(item.id, "publish")}
                      >
                        {actionLoadingKey === `${item.id}:publish` ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span>Publishing...</span>
                          </>
                        ) : (
                          <span>Publish to portals</span>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )) : (
              <div className="rounded-[1.25rem] border border-dashed border-[#2D8A6A]/25 bg-[#FAF7F0] p-6 text-center font-bold text-[#245C4F]">
                {loading ? "Loading assessment records..." : "No assessment report available."}
              </div>
            )}
          </div>

          {filteredItems.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3 border-t border-[#2D8A6A]/12 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#245C4F]">
                Showing <span className="font-semibold text-[#063F32]">{startItem}-{endItem}</span> of{" "}
                <span className="font-semibold text-[#063F32]">{filteredItems.length}</span>
              </p>

              {totalPages > 1 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                    disabled={currentReportPage <= 1}
                    className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>

                  {pageNumbers.map((number) => (
                    <button
                      key={number}
                      type="button"
                      onClick={() => setReportPage(number)}
                      className={`min-w-10 rounded-full px-4 py-2 text-sm font-semibold transition ${number === currentReportPage
                          ? "bg-[linear-gradient(135deg,#C9A227,#E4C766)] text-[#063F32] shadow-sm font-bold"
                          : "border border-[#2D8A6A]/20 bg-[#FAF7F0] text-[#063F32] hover:bg-[#F1EADC]"
                        }`}
                    >
                      {number}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setReportPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentReportPage >= totalPages}
                    className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {correctionModalItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-[2rem] border border-[#2D8A6A]/20 bg-white p-6 sm:p-8 shadow-[0_25px_70px_-20px_rgba(15,76,58,0.5)] animate-in zoom-in-95 duration-200">
            <button
              type="button"
              className="absolute right-5 top-5 rounded-full p-2 text-[#245C4F] transition hover:bg-[#FAF7F0] hover:text-[#063F32]"
              onClick={() => {
                if (!saving) {
                  setCorrectionModalItem(null);
                  setCorrectionComment("");
                  setCorrectionError("");
                }
              }}
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <span className="inline-block rounded-full bg-[#FFF8E4] px-3 py-1 text-xs font-black uppercase tracking-[0.15em] text-[#C79A3B]">
                Coordinator Review
              </span>
              <h3 className="mt-2 text-2xl font-black text-[#063F32]">Request Correction</h3>
              <p className="mt-1 text-sm font-semibold text-[#245C4F]">
                Student: <span className="font-bold text-[#063F32]">{correctionModalItem.student_name}</span> &bull; {correctionModalItem.class_name || "-"} ({correctionModalItem.term} - {correctionModalItem.academic_year})
              </p>
            </div>

            <form onSubmit={submitCorrectionRequest} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-[0.18em] text-[#0F4C3A]">
                  Reason / Instructions for Teacher <span className="text-rose-600">*</span>
                </label>
                <textarea
                  className="mt-2 w-full min-h-[140px] rounded-[1.25rem] border border-[#2D8A6A]/25 bg-[#FAF7F0] p-4 text-sm font-semibold text-[#063F32] outline-none transition focus:border-[#C79A3B] focus:bg-white focus:ring-4 focus:ring-[#C79A3B]/15"
                  placeholder="Specify what needs to be updated or corrected by the teacher before this assessment can be approved..."
                  value={correctionComment}
                  autoFocus
                  onChange={(e) => {
                    setCorrectionComment(e.target.value);
                    if (correctionError) setCorrectionError("");
                  }}
                />
                {correctionError ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-rose-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{correctionError}</span>
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className={ghostButtonClass}
                  disabled={saving}
                  onClick={() => {
                    setCorrectionModalItem(null);
                    setCorrectionComment("");
                    setCorrectionError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#9C2D2D] px-6 py-3 text-sm font-bold text-white shadow-[0_14px_30px_-18px_rgba(156,45,45,.8)] transition hover:bg-[#802222] disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-2"
                  disabled={saving}
                >
                  {saving && actionLoadingKey === `${correctionModalItem?.id}:correction` ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Sending Correction Request...</span>
                    </>
                  ) : (
                    <span>Send Correction Request</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
