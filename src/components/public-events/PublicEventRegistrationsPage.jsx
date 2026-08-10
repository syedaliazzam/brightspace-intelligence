"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, RotateCcw, Search } from "lucide-react";
import { formatEventDate, formatEventDateTime, formatMoney, formatRegistrationStatusLabel, normalizeRegistrationStatus } from "@/lib/publicEvents";

const INITIAL_CREATE_FORM = {
  eventId: "",
  eventCategory: "",
  email: "",
  whatsappCountryCode: "+92",
  whatsapp: "",
  studentName: "",
  studentNames: [""],
  parentName: "",
  schoolName: "",
  className: "",
  notes: "",
};

function isValidName(value) {
  return /^[a-zA-Z]+(?:[a-zA-Z\s'.-]*[a-zA-Z])?$/.test(String(value || "").trim());
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

const COUNTRY_PHONE_DIGIT_LIMITS = {
  "+1": 10,
  "+20": 10,
  "+27": 9,
  "+30": 10,
  "+31": 9,
  "+32": 9,
  "+33": 9,
  "+34": 9,
  "+36": 9,
  "+39": 10,
  "+40": 9,
  "+41": 9,
  "+43": 10,
  "+44": 10,
  "+45": 8,
  "+46": 9,
  "+47": 8,
  "+48": 9,
  "+49": 10,
  "+51": 9,
  "+52": 10,
  "+53": 8,
  "+54": 10,
  "+55": 11,
  "+56": 9,
  "+57": 10,
  "+58": 10,
  "+60": 9,
  "+61": 9,
  "+62": 10,
  "+63": 10,
  "+64": 9,
  "+65": 8,
  "+66": 9,
  "+81": 10,
  "+82": 10,
  "+84": 9,
  "+86": 11,
  "+90": 10,
  "+91": 10,
  "+92": 10,
  "+93": 9,
  "+94": 9,
  "+95": 9,
  "+98": 10,
  "+211": 9,
  "+212": 9,
  "+213": 9,
  "+216": 8,
  "+218": 9,
  "+220": 7,
  "+221": 9,
  "+222": 8,
  "+223": 8,
  "+224": 9,
  "+225": 10,
  "+226": 8,
  "+227": 8,
  "+228": 8,
  "+229": 8,
  "+230": 8,
  "+231": 8,
  "+232": 8,
  "+233": 9,
  "+234": 10,
  "+235": 8,
  "+236": 8,
  "+237": 9,
  "+238": 7,
  "+239": 7,
  "+240": 9,
  "+241": 8,
  "+242": 9,
  "+243": 9,
  "+244": 9,
  "+245": 7,
  "+246": 7,
  "+248": 7,
  "+249": 9,
  "+250": 9,
  "+251": 9,
  "+252": 8,
  "+253": 8,
  "+254": 9,
  "+255": 9,
  "+256": 9,
  "+257": 8,
  "+258": 9,
  "+260": 9,
  "+261": 9,
  "+262": 9,
  "+263": 9,
  "+264": 9,
  "+265": 9,
  "+266": 8,
  "+267": 8,
  "+268": 8,
  "+269": 7,
  "+290": 4,
  "+291": 7,
  "+297": 7,
  "+298": 6,
  "+299": 6,
  "+350": 8,
  "+351": 9,
  "+352": 9,
  "+353": 9,
  "+354": 7,
  "+355": 9,
  "+356": 8,
  "+357": 8,
  "+358": 9,
  "+359": 9,
  "+370": 8,
  "+371": 8,
  "+372": 8,
  "+373": 8,
  "+374": 8,
  "+375": 9,
  "+376": 6,
  "+377": 8,
  "+378": 10,
  "+380": 9,
  "+381": 9,
  "+382": 8,
  "+385": 9,
  "+386": 8,
  "+387": 8,
  "+389": 8,
  "+420": 9,
  "+421": 9,
  "+423": 7,
  "+500": 5,
  "+501": 7,
  "+502": 8,
  "+503": 8,
  "+504": 8,
  "+505": 8,
  "+506": 8,
  "+507": 8,
  "+508": 6,
  "+509": 8,
  "+590": 9,
  "+591": 8,
  "+592": 7,
  "+593": 9,
  "+594": 9,
  "+595": 9,
  "+596": 9,
  "+597": 7,
  "+598": 8,
  "+599": 7,
  "+670": 8,
  "+672": 6,
  "+673": 7,
  "+674": 7,
  "+675": 8,
  "+676": 7,
  "+677": 7,
  "+678": 7,
  "+679": 7,
  "+680": 7,
  "+681": 6,
  "+682": 5,
  "+683": 4,
  "+685": 7,
  "+686": 5,
  "+687": 6,
  "+688": 5,
  "+689": 8,
  "+690": 4,
  "+691": 7,
  "+692": 7,
  "+850": 10,
  "+852": 8,
  "+853": 8,
  "+855": 9,
  "+856": 9,
  "+880": 10,
  "+886": 9,
  "+960": 7,
  "+961": 8,
  "+962": 9,
  "+963": 9,
  "+964": 10,
  "+965": 8,
  "+966": 9,
  "+967": 9,
  "+968": 8,
  "+970": 9,
  "+971": 9,
  "+972": 9,
  "+973": 8,
  "+974": 8,
  "+975": 8,
  "+976": 8,
  "+977": 10,
  "+992": 9,
  "+993": 8,
  "+994": 9,
  "+995": 9,
  "+996": 9,
  "+998": 9,
};

function getCountryDialLength(code) {
  const value = String(code || "").trim();
  if (COUNTRY_PHONE_DIGIT_LIMITS[value]) return COUNTRY_PHONE_DIGIT_LIMITS[value];
  const dialDigits = value.replace(/\D/g, "").length;
  return Math.max(6, Math.min(12, 15 - dialDigits));
}

const WHATSAPP_COUNTRY_CODES = [
  "+92",
  "+1",
  "+44",
  "+971",
  "+61",
  "+91",
  "+86",
  "+966",
  "+973",
  "+974",
  "+968",
  "+20",
  "+33",
  "+49",
  "+39",
  "+81",
  "+65",
  "+60",
  "+880",
];

function getSelectedEvent(events, eventId) {
  return events.find((item) => item.id === eventId) || null;
}

function normalizeEventCategory(value) {
  const key = String(value || "").toLowerCase().trim().replace(/[_\s]+/g, "-");
  if (key === "ashshajrah-students" || key === "alh-students") return "alh-students";
  if (key === "ashshajrah-parents" || key === "alh-parents") return "alh-parents";
  if (key === "general-students") return "general-students";
  if (key === "general-parents") return "general-parents";
  return key;
}

function isEventRegistrationOpen(eventItem) {
  if (!eventItem) return false;
  const now = Date.now();
  const deadline = eventItem.registration_deadline ? new Date(eventItem.registration_deadline).getTime() : NaN;
  const endTime = eventItem.end_at ? new Date(eventItem.end_at).getTime() : NaN;
  const published = String(eventItem.publication_status || "").toLowerCase() === "published";
  const deadlineOpen = Number.isNaN(deadline) ? true : deadline >= now;
  const endOpen = Number.isNaN(endTime) ? true : endTime >= now;
  return published && deadlineOpen && endOpen;
}

function statusTone(status) {
  const normalized = normalizeRegistrationStatus(status);
  if (normalized === "free") return "bg-[#E6F4FF] text-[#08527A]";
  if (normalized === "verified") return "bg-[#EAF6EF] text-[#0D5C48]";
  if (normalized === "cancelled") return "bg-[#FCE7E7] text-[#9F1D1D]";
  return "bg-[#FFF5D6] text-[#7A5E2B]";
}

function matchesSearch(item, query) {
  const value = String(query || "").trim().toLowerCase();
  if (!value) return true;
  return [item.registration_no, item.event_name, item.participant_name, item.email, item.whatsapp, item.status_label, item.status]
    .map((entry) => String(entry || "").toLowerCase())
    .some((entry) => entry.includes(value));
}

export default function PublicEventRegistrationsPage({ portalLabel = "Coordinator portal", title = "Event registrations", description = "Review public event registrations, verify payments, and track each registration from one LMS table.", canManage = true, }) {
  const pageSize = 7;
  const normalizedPortalLabel = String(portalLabel).toLowerCase().trim();
  const showReceivedAmountColumn = normalizedPortalLabel === "coordinator portal" || normalizedPortalLabel === "super admin portal" || normalizedPortalLabel === "superadmin portal";
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [countryCodes, setCountryCodes] = useState([
    "+1", "+20", "+27", "+30", "+31", "+32", "+33", "+34", "+36", "+39",
    "+40", "+41", "+43", "+44", "+45", "+46", "+47", "+48", "+49", "+51",
    "+52", "+53", "+54", "+55", "+56", "+57", "+58", "+60", "+61", "+62",
    "+63", "+64", "+65", "+66", "+81", "+82", "+84", "+86", "+90", "+91",
    "+92", "+93", "+94", "+95", "+98", "+211", "+212", "+213", "+216", "+218",
    "+220", "+221", "+222", "+223", "+224", "+225", "+226", "+227", "+228", "+229",
    "+230", "+231", "+232", "+233", "+234", "+235", "+236", "+237", "+238", "+239",
    "+240", "+241", "+242", "+243", "+244", "+245", "+246", "+248", "+249", "+250",
    "+251", "+252", "+253", "+254", "+255", "+256", "+257", "+258", "+260", "+261",
    "+262", "+263", "+264", "+265", "+266", "+267", "+268", "+269", "+290", "+291",
    "+297", "+298", "+299", "+350", "+351", "+352", "+353", "+354", "+355", "+356",
    "+357", "+358", "+359", "+370", "+371", "+372", "+373", "+374", "+375", "+376",
    "+377", "+378", "+380", "+381", "+382", "+385", "+386", "+387", "+389", "+420",
    "+421", "+423", "+500", "+501", "+502", "+503", "+504", "+505", "+506", "+507",
    "+508", "+509", "+590", "+591", "+592", "+593", "+594", "+595", "+596", "+597",
    "+598", "+599", "+670", "+672", "+673", "+674", "+675", "+676", "+677", "+678",
    "+679", "+680", "+681", "+682", "+683", "+685", "+686", "+687", "+688", "+689",
    "+690", "+691", "+692", "+850", "+852", "+853", "+855", "+856", "+880", "+886",
    "+960", "+961", "+962", "+963", "+964", "+965", "+966", "+967", "+968", "+970",
    "+971", "+972", "+973", "+974", "+975", "+976", "+977", "+992", "+993", "+994",
    "+995", "+996", "+998"
  ]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("success");
  const [createModalOpen, setCreateModalOpen] = useState(false);  
  const [createForm, setCreateForm] = useState(INITIAL_CREATE_FORM);
  const [createErrors, setCreateErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState("");
  const [createSuccess, setCreateSuccess] = useState(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [receivedAmountDrafts, setReceivedAmountDrafts] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [draftStatuses, setDraftStatuses] = useState({});
  const [openFilterSelect, setOpenFilterSelect] = useState("");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ eventId: "all", status: "all", dateFrom: "", dateTo: "", search: "", sortBy: "submitted_at", sortDir: "desc" });

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to load event registrations.");
      setItems(Array.isArray(data.items) ? data.items : []);
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to load event registrations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/coordinator/public-event-registrations", { cache: "no-store" });
        const data = await response.json();
        if (!active) return;
        if (!response.ok) throw new Error(data?.message || "Unable to load event registrations.");
        setItems(Array.isArray(data.items) ? data.items : []);
        setEvents(Array.isArray(data.events) ? data.events : []);
      } catch (error) {
        if (!active) return;
        setTone("error");
        setMessage(error instanceof Error ? error.message : "Unable to load event registrations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/public/country-calling-codes", { cache: "no-store" });
        const data = await response.json();
        if (!active || !response.ok) return;
        const nextCodes = Array.isArray(data?.codes) ? data.codes.map((item) => String(item || "").trim()).filter(Boolean) : [];
        if (nextCodes.length > 0) {
          setCountryCodes(Array.from(new Set(["+92", ...nextCodes])));
        }
      } catch {
        if (active) {
          setCountryCodes([
            "+1", "+20", "+27", "+30", "+31", "+32", "+33", "+34", "+36", "+39",
            "+40", "+41", "+43", "+44", "+45", "+46", "+47", "+48", "+49", "+51",
            "+52", "+53", "+54", "+55", "+56", "+57", "+58", "+60", "+61", "+62",
            "+63", "+64", "+65", "+66", "+81", "+82", "+84", "+86", "+90", "+91",
            "+92", "+93", "+94", "+95", "+98", "+211", "+212", "+213", "+216", "+218",
            "+220", "+221", "+222", "+223", "+224", "+225", "+226", "+227", "+228", "+229",
            "+230", "+231", "+232", "+233", "+234", "+235", "+236", "+237", "+238", "+239",
            "+240", "+241", "+242", "+243", "+244", "+245", "+246", "+248", "+249", "+250",
            "+251", "+252", "+253", "+254", "+255", "+256", "+257", "+258", "+260", "+261",
            "+262", "+263", "+264", "+265", "+266", "+267", "+268", "+269", "+290", "+291",
            "+297", "+298", "+299", "+350", "+351", "+352", "+353", "+354", "+355", "+356",
            "+357", "+358", "+359", "+370", "+371", "+372", "+373", "+374", "+375", "+376",
            "+377", "+378", "+380", "+381", "+382", "+385", "+386", "+387", "+389", "+420",
            "+421", "+423", "+500", "+501", "+502", "+503", "+504", "+505", "+506", "+507",
            "+508", "+509", "+590", "+591", "+592", "+593", "+594", "+595", "+596", "+597",
            "+598", "+599", "+670", "+672", "+673", "+674", "+675", "+676", "+677", "+678",
            "+679", "+680", "+681", "+682", "+683", "+685", "+686", "+687", "+688", "+689",
            "+690", "+691", "+692", "+850", "+852", "+853", "+855", "+856", "+880", "+886",
            "+960", "+961", "+962", "+963", "+964", "+965", "+966", "+967", "+968", "+970",
            "+971", "+972", "+973", "+974", "+975", "+976", "+977", "+992", "+993", "+994",
            "+995", "+996", "+998"
          ]);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setDraftStatuses(Object.fromEntries(items.map((item) => [item.id, normalizeRegistrationStatus(item.status)])));
  }, [items]);



  const availableCreateEvents = useMemo(() => {
    return events.filter((item) => isEventRegistrationOpen(item));
  }, [events]);

  const selectedCreateEvent = useMemo(() => getSelectedEvent(events, createForm.eventId), [createForm.eventId, events]);
  const selectedCreateEventCategory = normalizeEventCategory(selectedCreateEvent?.event_category || createForm.eventCategory || "");
  const createFormLocked = createForm.eventId ? !isEventRegistrationOpen(selectedCreateEvent) : false;
  const selectedWhatsappDigitsRequired = getCountryDialLength(createForm.whatsappCountryCode);
  const whatsappDigitsEntered = normalizePhoneDigits(createForm.whatsapp).length;
  const whatsappDigitsRemaining = Math.max(selectedWhatsappDigitsRequired - whatsappDigitsEntered, 0);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (filters.eventId !== "all" && item.event_id !== filters.eventId) return false;
      if (filters.status !== "all" && normalizeRegistrationStatus(item.status) !== filters.status) return false;
      const submittedAt = item.submitted_at ? new Date(item.submitted_at) : null;
      if (filters.dateFrom && submittedAt && submittedAt < new Date(String(filters.dateFrom) + "T00:00:00")) return false;
      if (filters.dateTo && submittedAt && submittedAt > new Date(String(filters.dateTo) + "T23:59:59")) return false;
      return matchesSearch(item, filters.search);
    });

    return [...filtered].sort((left, right) => {
      const direction = filters.sortDir === "asc" ? 1 : -1;
      const leftValue = left[filters.sortBy];
      const rightValue = right[filters.sortBy];
      if (filters.sortBy === "amount_due") return (Number(leftValue || 0) - Number(rightValue || 0)) * direction;
      if (filters.sortBy === "submitted_at") return ((new Date(leftValue || 0)).getTime() - (new Date(rightValue || 0)).getTime()) * direction;
      return String(leftValue || "").localeCompare(String(rightValue || ""), "en", { sensitivity: "base" }) * direction;
    });
  }, [filters, items]);

  const verifiedTotalAmount = useMemo(() => items.reduce((sum, item) => (normalizeRegistrationStatus(item.status) === "verified" ? sum + Number(item.amount_due || 0) : sum), 0), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => filteredItems.slice((safePage - 1) * pageSize, (safePage - 1) * pageSize + pageSize), [filteredItems, safePage]);

  useEffect(() => { setPage(1); }, [filters]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function updateStatus(id, status) {
    setActionLoadingId(id);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update registration status.");
      setTone("success");
      setMessage("Registration marked " + formatRegistrationStatusLabel(status).toLowerCase() + ".");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update registration status.");
    } finally {
      setActionLoadingId("");
    }
  }

  function updateReceivedAmountDraft(itemId, value) {
    setReceivedAmountDrafts((current) => ({ ...current, [itemId]: value }));
  }

  async function saveReceivedAmount(item) {
    if (!item?.id) return;
    const nextAmount = Number(receivedAmountDrafts[item.id] ?? item.amount_due ?? 0);
    setActionLoadingId(item.id);
    try {
      const response = await fetch("/api/coordinator/public-event-registrations/" + encodeURIComponent(item.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountDue: nextAmount }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Unable to update received amount.");
      setTone("success");
      setMessage("Received amount updated.");
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to update received amount.");
    } finally {
      setActionLoadingId("");
    }
  }

  function resetFilters() {
    setPage(1);
    setFilters({ eventId: "all", status: "all", dateFrom: "", dateTo: "", search: "", sortBy: "submitted_at", sortDir: "desc" });
  }

  function resetCreateForm() {
    setCreateForm({
      ...INITIAL_CREATE_FORM,
      eventId: "",
    });
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSuccess(null);
    setCreateSubmitting(false);
  }

  function openCreateModal() {
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSuccess(null);
    setCreateSubmitting(false);
    setCreateEventOpen(false);
    setCreateModalOpen(true);
    setCreateForm(INITIAL_CREATE_FORM);
  }

  function closeCreateModal() {
    setCreateModalOpen(false);
    setCreateErrors({});
    setCreateSubmitError("");
    setCreateSuccess(null);
    setCreateSubmitting(false);
    resetCreateForm();
  }

  function validateCreateForm() {
    const nextErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const whatsappDigits = normalizePhoneDigits(createForm.whatsapp);
    const category = String(selectedCreateEventCategory || "").trim();
    const emailValue = String(createForm.email || "").trim().toLowerCase();
    const studentNameValue = String(createForm.studentName || "").trim();
    const parentNameValue = String(createForm.parentName || "").trim();
    const schoolNameValue = String(createForm.schoolName || "").trim();
    const classValue = String(createForm.className || "").trim();
    const studentNames = Array.isArray(createForm.studentNames) ? createForm.studentNames.map((item) => String(item || "").trim()).filter(Boolean) : [];

    if (!createForm.eventId) {
      nextErrors.eventId = "Please select an event.";
    }
    if (!emailValue) {
      nextErrors.email = "Email is required.";
    } else if (!emailRegex.test(emailValue)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!whatsappDigits) {
      nextErrors.whatsapp = "WhatsApp number is required.";
    } else if (whatsappDigits.length !== selectedWhatsappDigitsRequired) {
      nextErrors.whatsapp = "Please enter a valid WhatsApp number.";
    }
    if ((category === "alh-students" || category === "general-students") && !studentNameValue) {
      nextErrors.studentName = "Student name is required.";
    }
    if (category === "general-students") {
      if (!schoolNameValue) nextErrors.schoolName = "School name is required.";
      if (!classValue) nextErrors.className = "Class is required.";
    }
    if (category === "alh-parents" || category === "general-parents") {
      if (studentNames.length === 0) nextErrors.studentNames = "At least one student name is required.";
      if (!parentNameValue) nextErrors.parentName = "Parent name is required.";
    }

    return nextErrors;
  }

  async function handleCreateRegistration(event) {
    event.preventDefault();
    if (createSubmitting) return;

    const nextErrors = validateCreateForm();
    if (Object.keys(nextErrors).length > 0) {
      setCreateErrors(nextErrors);
      return;
    }

    setCreateSubmitting(true);
    setCreateErrors({});
    setCreateSubmitError("");

    try {
      const response = await fetch("/api/event-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: createForm.eventId,
        eventCategory: selectedCreateEventCategory,
        email: String(createForm.email || "").trim(),
        whatsappCountryCode: String(createForm.whatsappCountryCode || "").trim(),
        whatsapp: normalizePhoneDigits(createForm.whatsapp),
        studentName: String(createForm.studentName || "").trim(),
        studentNames: Array.isArray(createForm.studentNames) ? createForm.studentNames.map((item) => String(item || "").trim()).filter(Boolean) : [],
        parentName: String(createForm.parentName || "").trim(),
        schoolName: String(createForm.schoolName || "").trim(),
        className: String(createForm.className || "").trim(),
        notes: String(createForm.notes || "").trim(),
      }),
    });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = data?.message || "Unable to create event registration.";
        setCreateSubmitError(apiMessage);
        throw new Error(apiMessage);
      }

      setTone("success");
      setCreateSuccess({
        registrationNo: data?.registrationNo || data?.registrationNumber || "",
        coordinatorName: selectedCreateEvent?.coordinator_name || "Coordinator",
        coordinatorEmail: selectedCreateEvent?.coordinator_email || "",
        coordinatorPhone: selectedCreateEvent?.coordinator_phone || "+92 3473547036",
      });
      await load();
    } catch (error) {
      setTone("error");
      setMessage(error instanceof Error ? error.message : "Unable to create event registration.");
    } finally {
      setCreateSubmitting(false);
    }
  }
  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        {message ? <div className={`fixed right-4 top-4 z-[10000] rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-24px_rgba(13,59,46,0.45)] ${tone === "success" ? "border-[#2D8A6A]/25 bg-[linear-gradient(135deg,#0D3B2E,#0D5C48)] text-[#FFF5D6]" : "border-rose-200 bg-white text-rose-700"}`}>{message}</div> : null}

        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FFF5D6]">{portalLabel}</p>
                <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#EAF6EF] sm:text-base">{description}</p>
              </div>
              {canManage ? (
                <button type="button" onClick={openCreateModal} className="inline-flex items-center justify-center rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-5 py-3 text-sm font-semibold text-[#FFF5D6] transition hover:bg-[#FFF5D6] hover:text-[#0D3B2E]">
                  Create Event Registration
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.length}</p><p className="text-xs text-[#EAF6EF]">Total</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "pending").length}</p><p className="text-xs text-[#EAF6EF]">Pending</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "verified").length}</p><p className="text-xs text-[#EAF6EF]">Verified</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3"><p className="font-semibold">{items.filter((item) => normalizeRegistrationStatus(item.status) === "free").length}</p><p className="text-xs text-[#EAF6EF]">Free</p></div>
              <div className="rounded-2xl border border-[#E4C766]/30 bg-[#FAF7F0]/10 px-4 py-3 flex justify-between flex-col"><p className="font-semibold whitespace-nowrap">{formatMoney(verifiedTotalAmount)}</p><p className="text-xs text-[#EAF6EF] whitespace-nowrap">Total Amount</p></div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="border-b border-[#2D8A6A]/10 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Registration filters</p>
          </div>
          <div className="grid gap-4 px-6 py-5 lg:grid-cols-6">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Event</span>
              <div className="relative">
                <select value={filters.eventId} onFocus={() => setOpenFilterSelect("event")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); setFilters((current) => ({ ...current, eventId: event.target.value })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="all">All events</option>
                  {events.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "event" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Status</span>
              <div className="relative">
                <select value={filters.status} onFocus={() => setOpenFilterSelect("status")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); setFilters((current) => ({ ...current, status: event.target.value })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="all">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="free">Free</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "status" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">From date</span>
              <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">To date</span>
              <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Sort by</span>
              <div className="relative">
                <select value={`${filters.sortBy}:${filters.sortDir}`} onFocus={() => setOpenFilterSelect("sort")} onBlur={() => setOpenFilterSelect("")} onChange={(event) => { setOpenFilterSelect(""); const [sortBy, sortDir] = String(event.target.value || "").split(":"); setFilters((current) => ({ ...current, sortBy, sortDir })); }} className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]">
                  <option value="submitted_at:desc">Latest submitted</option>
                  <option value="submitted_at:asc">Oldest submitted</option>
                  <option value="event_name:asc">Event name A-Z</option>
                  <option value="participant_name:asc">Participant A-Z</option>
                  <option value="amount_due:desc">Amount high-low</option>
                  <option value="amount_due:asc">Amount low-high</option>
                  <option value="status:asc">Status A-Z</option>
                </select>
                <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition ${openFilterSelect === "sort" ? "rotate-180" : ""}`} />
              </div>
            </label>

            <div className="flex items-end">
              <button type="button" onClick={resetFilters} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">
                <RotateCcw className="h-4 w-4" />
                Reset filters
              </button>
            </div>

            <label className="block lg:col-span-6">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2D8A6A]" />
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search registration no, event, participant, email, WhatsApp, or status" className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white py-3 pl-11 pr-4 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]" />
              </div>
            </label>
          </div>
        </section>
        <section className="overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,247,240,0.98))] shadow-[0_20px_70px_-36px_rgba(13,59,46,0.18)]">
          <div className="flex items-center justify-between border-b border-[#2D8A6A]/10 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#0D5C48]">Registered events data</p>
            <div className="text-sm font-semibold text-[#245C4F]">Showing {filteredItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredItems.length)} of {filteredItems.length}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="bg-[linear-gradient(180deg,#FAF7F0_0%,#F1EADC_100%)] text-xs uppercase tracking-[0.18em] text-[#0D5C48]">
                <tr>
                  <th className="whitespace-nowrap px-6 py-4">Registration No</th>
                  <th className="whitespace-nowrap px-6 py-4">Event</th>
                  <th className="whitespace-nowrap px-6 py-4">Event Date</th>
                  <th className="whitespace-nowrap px-6 py-4">Student Name</th>
                  <th className="whitespace-nowrap px-6 py-4">Parent Name</th>
                  <th className="whitespace-nowrap px-6 py-4">School Name</th>
                  <th className="whitespace-nowrap px-6 py-4">Class Name</th>
                  <th className="whitespace-nowrap px-6 py-4">Email</th>
                  <th className="whitespace-nowrap px-6 py-4">WhatsApp</th>
                  {showReceivedAmountColumn ? <th className="whitespace-nowrap px-6 py-4">Received Amount</th> : null}
                  <th className="whitespace-nowrap px-6 py-4">Status</th>
                  <th className="whitespace-nowrap px-6 py-4">Submitted</th>
                  <th className="w-[280px] min-w-[280px] whitespace-nowrap px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1EADC]">
                {visibleItems.length ? visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 font-semibold text-[#063F32]">{item.registration_no}</td>
                    <td className="px-6 py-4 font-medium text-[#063F32]">{item.event_name}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatEventDate(item.event_start_at)}</td>
                    <td className="px-6 py-4 text-[#245C4F]">
                      {Array.isArray(item.student_names) && item.student_names.length > 0
                        ? item.student_names.join(", ")
                        : item.student_name || "-"}
                    </td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.parent_name || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.school_name || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.class_input || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.email || "-"}</td>
                    <td className="px-6 py-4 text-[#245C4F]">{item.whatsapp || "-"}</td>
                    {showReceivedAmountColumn ? (
                      <td className="px-6 py-4">
                        {normalizeRegistrationStatus(item.status) === "free" ? (
                          <div className="flex min-w-max flex-nowrap items-center gap-2 sm:min-w-[220px]">
                            <div className="w-full min-w-[130px] rounded-full border border-[#2D8A6A]/10 bg-[#F7F2E8] px-3 py-2 text-sm font-semibold text-[#063F32]">
                              0.00
                            </div>
                          </div>
                        ) : (
                          <div className="flex min-w-max flex-nowrap items-center gap-2 sm:min-w-[220px]">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={receivedAmountDrafts[item.id] ?? String(Number(item.amount_due || 0))}
                              placeholder="Enter received amount"
                              onChange={(event) => updateReceivedAmountDraft(item.id, event.target.value)}
                              className="w-full min-w-[130px] rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                            />
                            <button
                              type="button"
                              onClick={() => saveReceivedAmount(item)}
                              disabled={actionLoadingId === item.id}
                              className="inline-flex w-fit shrink-0 items-center justify-center rounded-full border whitespace-nowrap border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-1.5 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-70"
                            >
                              {actionLoadingId === item.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        )}
                      </td>
                    ) : null}
                    <td className="px-6 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusTone(item.status)}`}>{item.status_label || formatRegistrationStatusLabel(item.status)}</span></td>
                    <td className="px-6 py-4 text-[#245C4F]">{formatEventDateTime(item.submitted_at)}</td>
                    <td className="w-[280px] min-w-[280px] max-w-[280px] px-6 py-4">
                      <div className="flex max-w-full flex-nowrap items-center gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => setSelected(item)} className="inline-flex shrink-0 items-center rounded-full border border-[#2D8A6A]/20 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-[#063F32] whitespace-nowrap transition hover:bg-[#F1EADC]"><span className="inline-flex items-center gap-1 whitespace-nowrap"><Eye className="h-3 w-3" />View</span></button>
                        {canManage && normalizeRegistrationStatus(item.status) !== "free" ? (
                          <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-hidden whitespace-nowrap">
                            <select value={draftStatuses[item.id] || normalizeRegistrationStatus(item.status)} onChange={(event) => setDraftStatuses((current) => ({ ...current, [item.id]: event.target.value }))} className="w-[90px] min-w-[90px] shrink-0 rounded-full border border-[#2D8A6A]/20 bg-white px-3 py-2 text-[11px] font-semibold text-[#063F32] outline-none focus:border-[#2D8A6A]">
                              <option value="pending">Pending</option>
                              <option value="verified">Verified</option>
                              <option value="free">Free</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <button type="button" disabled={actionLoadingId === item.id || (draftStatuses[item.id] || normalizeRegistrationStatus(item.status)) === normalizeRegistrationStatus(item.status)} onClick={() => updateStatus(item.id, draftStatuses[item.id] || normalizeRegistrationStatus(item.status))} className="shrink-0 rounded-full bg-[#0D5C48] px-3 py-2 text-[11px] font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70">
                              {actionLoadingId === item.id ? "Saving..." : "Save"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={showReceivedAmountColumn ? 10 : 9} className="px-6 py-10 text-center text-[#245C4F]">{loading ? "Loading event registrations..." : "No registrations matched the selected filters."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredItems.length > pageSize ? (
            <div className="flex flex-col gap-3 border-t border-[#2D8A6A]/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[#245C4F]">Page {safePage} of {totalPages}</p>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:cursor-not-allowed disabled:opacity-50">Next</button>
              </div>
            </div>
          ) : null}
        </section>

        {createModalOpen ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-[#063F32]/45 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[calc(100vh-48px)] overflow-y-auto rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Create event registration</p>
                </div>
                <button type="button" onClick={closeCreateModal} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              {createSuccess ? (
                <div className="space-y-5 p-6 text-sm text-[#245C4F]">
                  <div className="rounded-[1.5rem] border border-[#2D8A6A]/12 bg-white px-5 py-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Registration submitted successfully</p>
                    <p className="mt-3 text-2xl font-bold text-[#063F32]">{createSuccess.registrationNo || "-"}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[#2D8A6A]/12 bg-[#FAF7F0] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Coordinator name</p>
                        <p className="mt-1 font-semibold text-[#063F32]">{createSuccess.coordinatorName || "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-[#2D8A6A]/12 bg-[#FAF7F0] px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Coordinator contact</p>
                        <p className="mt-1 font-semibold text-[#063F32]">{createSuccess.coordinatorEmail || createSuccess.coordinatorPhone || "-"}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button type="button" onClick={closeCreateModal} className="rounded-full bg-[#0D5C48] px-5 py-2 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32]">Close</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateRegistration} className="space-y-5 p-6 text-sm text-[#245C4F]">
                  <div className="grid gap-4 md:grid-cols-2">
                    {createSubmitError ? <div className="md:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{createSubmitError}</div> : null}
                    <label className="block md:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Event *</span>
                      <div className="relative">
                        <select
                          value={createForm.eventId}
                          onFocus={() => setCreateEventOpen(true)}
                          onBlur={() => setCreateEventOpen(false)}
                          onChange={(event) => {
                            const nextEventId = event.target.value;
                            const nextEvent = getSelectedEvent(events, nextEventId);
                            setCreateForm((current) => ({
                              ...current,
                              eventId: nextEventId,
                            eventCategory: normalizeEventCategory(nextEvent?.event_category || ""),
                              studentName: "",
                              studentNames: [""],
                              parentName: "",
                              schoolName: "",
                              className: "",
                            }));
                          }}
                          disabled={createSubmitting}
                          className="w-full appearance-none rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 pr-11 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A]"
                        >
                          <option value="">Select an open event</option>
                          {availableCreateEvents.map((item) => (
                            <option key={item.id} value={item.id}>{item.title}</option>
                          ))}
                        </select>
                        <ChevronDown className={`pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0D5C48] transition-transform duration-200 ${createEventOpen ? "rotate-180" : ""}`} />
                      </div>
                      {createErrors.eventId ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.eventId}</p> : null}
                      {createForm.eventId ? (
                        <div className="mt-3 rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3 text-xs text-[#245C4F]">
                          {(() => {
                            const selectedEvent = selectedCreateEvent || availableCreateEvents.find((item) => item.id === createForm.eventId) || events.find((item) => item.id === createForm.eventId);
                            const selectedFee = selectedEvent?.event_fee_amount ?? 0;
                            const selectedDeadline = selectedEvent?.registration_deadline || selectedEvent?.deadline || null;
                            return selectedEvent ? (
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <p className="font-semibold text-[#063F32]">{selectedEvent.title || "-"}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Start</p>
                                  <p className="mt-1">{formatEventDateTime(selectedEvent.start_at)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">End</p>
                                  <p className="mt-1">{formatEventDateTime(selectedEvent.end_at)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Deadline</p>
                                  <p className="mt-1">{formatEventDateTime(selectedDeadline)}</p>
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Fee</p>
                                  <p className="mt-1">{formatMoney(selectedFee)}</p>
                                </div>
                              </div>
                            ) : null;
                          })()}
                        </div>
                      ) : null}
                    </label>

                    {createForm.eventId ? (
                      <>
                        {selectedCreateEventCategory === "alh-students" || selectedCreateEventCategory === "general-students" ? (
                          <label className="block md:col-span-2">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Student name *</span>
                            <input value={createForm.studentName} onChange={(event) => setCreateForm((current) => ({ ...current, studentName: event.target.value }))} placeholder="Student full name" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                            {createErrors.studentName ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.studentName}</p> : null}
                          </label>
                        ) : null}

                        {(selectedCreateEventCategory === "alh-students" || selectedCreateEventCategory === "general-students") ? (
                          <label className="block md:col-span-2">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Parent / guardian name</span>
                            <input value={createForm.parentName} onChange={(event) => setCreateForm((current) => ({ ...current, parentName: event.target.value }))} placeholder="Parent / guardian name" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                            {createErrors.parentName ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.parentName}</p> : null}
                          </label>
                        ) : null}

                        {selectedCreateEventCategory === "general-students" ? (
                          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">School name *</span>
                              <input value={createForm.schoolName} onChange={(event) => setCreateForm((current) => ({ ...current, schoolName: event.target.value }))} placeholder="School name" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                              {createErrors.schoolName ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.schoolName}</p> : null}
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Class *</span>
                              <input value={createForm.className} onChange={(event) => setCreateForm((current) => ({ ...current, className: event.target.value }))} placeholder="Class name" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                              {createErrors.className ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.className}</p> : null}
                            </label>
                          </div>
                        ) : null}

                      {selectedCreateEventCategory === "alh-parents" || selectedCreateEventCategory === "general-parents" ? (
                        <div className="md:col-span-2 rounded-[1.5rem] border border-[#2D8A6A]/12 bg-white p-4">
                          <label className="mt-4 block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Parent name *</span>
                            <input value={createForm.parentName} onChange={(event) => setCreateForm((current) => ({ ...current, parentName: event.target.value }))} placeholder="Parent / guardian name" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                            {createErrors.parentName ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.parentName}</p> : null}
                          </label>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div>
                              <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Student names *</span>
                              <p className="mt-1 text-xs text-[#245C4F]">Add one or more student names for parent registrations.</p>
                            </div>
                            <button type="button" onClick={() => setCreateForm((current) => ({ ...current, studentNames: [...(Array.isArray(current.studentNames) ? current.studentNames : []), ""] }))} disabled={createSubmitting || createFormLocked} className="rounded-full border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-70">
                              Add student
                            </button>
                          </div>
                          <div className="mt-4 space-y-3">
                            {(Array.isArray(createForm.studentNames) ? createForm.studentNames : [""]).map((studentName, index) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  value={studentName}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setCreateForm((current) => {
                                      const nextStudentNames = Array.isArray(current.studentNames) ? [...current.studentNames] : [""];
                                      nextStudentNames[index] = nextValue;
                                      return { ...current, studentNames: nextStudentNames };
                                    });
                                  }}
                                  placeholder={`Student name ${index + 1}`}
                                  disabled={createSubmitting || createFormLocked}
                                  className="min-w-0 flex-1 rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]"
                                />
                                <button
                                  type="button"
                                  onClick={() => setCreateForm((current) => {
                                    const nextStudentNames = Array.isArray(current.studentNames) ? [...current.studentNames] : [""];
                                    nextStudentNames.splice(index, 1);
                                    return { ...current, studentNames: nextStudentNames.length ? nextStudentNames : [""] };
                                  })}
                                  disabled={createSubmitting || createFormLocked || (Array.isArray(createForm.studentNames) ? createForm.studentNames.length <= 1 : true)}
                                  className="rounded-2xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-xs font-semibold text-[#063F32] transition hover:bg-[#F1EADC] disabled:opacity-70"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                          {createErrors.studentNames ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.studentNames}</p> : null}
                        </div>
                      ) : null}

                        <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Email *</span>
                            <input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} placeholder="name@gmail.com" disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                            {createErrors.email ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.email}</p> : null}
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">WhatsApp *</span>
                            <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                            <select value={createForm.whatsappCountryCode} onChange={(event) => setCreateForm((current) => ({ ...current, whatsappCountryCode: event.target.value }))} disabled={createSubmitting || createFormLocked} className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]">
                                {countryCodes.map((code) => (
                                  <option key={code} value={code}>{code}</option>
                                ))}
                              </select>
                              <input
                                value={createForm.whatsapp}
                                onChange={(event) => {
                                  const digits = normalizePhoneDigits(event.target.value).slice(0, selectedWhatsappDigitsRequired);
                                  setCreateForm((current) => ({ ...current, whatsapp: digits }));
                                }}
                                placeholder="Local digits only"
                                inputMode="tel"
                                maxLength={selectedWhatsappDigitsRequired}
                                disabled={createSubmitting || createFormLocked}
                                className="w-full rounded-2xl border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]"
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-[#245C4F]">
                              <span>{createForm.whatsapp ? `${whatsappDigitsRemaining} digits remaining` : `${selectedWhatsappDigitsRequired} digits required`}</span>
                            </div>
                            {createErrors.whatsapp ? <p className="mt-2 text-xs font-semibold text-rose-700">{createErrors.whatsapp}</p> : null}
                          </label>
                        </div>

                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-[#0D5C48]">Comments</span>
                          <textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="If you want to share anything in advance with the coordinator" disabled={createSubmitting || createFormLocked} className="w-full rounded-[24px] border border-[#2D8A6A]/20 bg-white px-4 py-3 text-sm text-[#063F32] outline-none focus:border-[#2D8A6A] disabled:cursor-not-allowed disabled:bg-[#F7F2E8]" />
                        </label>
                      </>
                    ) : (
                      <div className="md:col-span-2 rounded-2xl border border-dashed border-[#2D8A6A]/20 bg-[#FAF7F0] px-4 py-5 text-sm text-[#245C4F]">
                        Select an event to load the registration fields.
                      </div>
                    )}

                    {createFormLocked ? (
                      <div className="md:col-span-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                        Registration is closed for this event, so the form is disabled.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={closeCreateModal} className="rounded-full border border-[#2D8A6A]/20 bg-white px-4 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Cancel</button>
                    <button type="submit" disabled={createSubmitting || createFormLocked} className="inline-flex w-full items-center justify-center rounded-full bg-[#0D5C48] px-5 py-3 text-sm font-semibold text-[#FAF7F0] transition hover:bg-[#063F32] disabled:opacity-70 sm:w-auto">
                      {createSubmitting ? "Creating..." : "Create event registration"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {selected ? (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#063F32]/45 px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#F1EADC] px-6 py-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#C9A227]">Registration details</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#063F32]">{selected.registration_no}</h2>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-[#2D8A6A]/20 bg-[#FAF7F0] px-3 py-2 text-sm font-semibold text-[#063F32] transition hover:bg-[#F1EADC]">Close</button>
              </div>
              <div className="space-y-4 p-6 text-sm text-[#245C4F]">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Event</p><p className="mt-1">{selected.event_name || "-"}</p></div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Amount due</p><p className="mt-1">{formatMoney(selected.amount_due || 0)}</p></div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-3"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Status</p><p className="mt-1">{formatRegistrationStatusLabel(selected.status)}</p></div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Participant information</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Student Name:</span> {Array.isArray(selected.student_names) && selected.student_names.length > 0 ? selected.student_names.join(", ") : selected.student_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Parent Name:</span> {selected.parent_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">School Name:</span> {selected.school_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Class:</span> {selected.class_input || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Email:</span> {selected.email || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">WhatsApp:</span> {selected.whatsapp || "-"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Event and verification</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Schedule:</span> {formatEventDateTime(selected.event_start_at)} to {formatEventDateTime(selected.event_end_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Submitted:</span> {formatEventDateTime(selected.submitted_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Verified at:</span> {formatEventDateTime(selected.verified_at)}</p>
                      <p><span className="font-semibold text-[#063F32]">Verified by:</span> {selected.verified_by_name || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Coordinator contact</p>
                    <div className="mt-3 space-y-2">
                      <p><span className="font-semibold text-[#063F32]">Name:</span> {selected.coordinator_name || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Email:</span> {selected.coordinator_email || "-"}</p>
                      <p><span className="font-semibold text-[#063F32]">Phone:</span> {selected.coordinator_phone || "+92 3473547036"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#2D8A6A]/12 bg-white px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0D5C48]">Notes</p>
                    <p className="mt-3 whitespace-pre-line">{selected.notes || "No notes provided."}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}



