"use client";

import { useEffect, useState } from "react";
import CoordinatorStatsCards from "@/components/coordinator/CoordinatorStatsCards";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import CoordinatorPortalSection from "@/components/coordinator/CoordinatorPortalSection";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import RegistrationLeadFilters from "@/components/coordinator/RegistrationLeadFilters";
import RegistrationLeadTable from "@/components/coordinator/RegistrationLeadTable";
import FeeVoucherFilters from "@/components/coordinator/FeeVoucherFilters";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import FeeVoucherTable from "@/components/coordinator/FeeVoucherTable";
import PaymentVerificationTable from "@/components/coordinator/PaymentVerificationTable";
import StudentTable from "@/components/coordinator/StudentTable";
import ParentTable from "@/components/coordinator/ParentTable";
import TeacherAssignmentForm from "@/components/coordinator/TeacherAssignmentForm";
import TeacherAssignmentTable from "@/components/coordinator/TeacherAssignmentTable";
import LectureScheduleForm from "@/components/coordinator/LectureScheduleForm";
import LectureScheduleTable from "@/components/coordinator/LectureScheduleTable";
import LectureVerificationTable from "@/components/coordinator/LectureVerificationTable";
import CoordinatorReportsPanel from "@/components/coordinator/CoordinatorReportsPanel";
import CoordinatorGoTopButton from "@/components/coordinator/CoordinatorGoTopButton";

const CACHE_KEY = "coordinator-dashboard";
const CACHE_TTL = 60 * 1000;

function readCache() {
  if (typeof window === "undefined") {
    return null;
  }

  const cached = window.sessionStorage.getItem(CACHE_KEY);
  if (!cached) {
    return null;
  }

  try {
    const parsed = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.payload;
  } catch {
    window.sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}

function writeCache(payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

function writeNamedCache(key, payload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    key,
    JSON.stringify({ timestamp: Date.now(), payload })
  );
}

export default function CoordinatorDashboardPage() {
  const [leadFilter, setLeadFilter] = useState({ search: "", status: "" });
  const [voucherFilter, setVoucherFilter] = useState({ search: "", status: "" });
  const [state, setState] = useState({
    loading: true,
    error: "",
    stats: null,
    recentLectures: [],
    recentLeads: [],
    reports: null,
    leads: [],
    vouchers: [],
    payments: [],
    students: [],
    parents: [],
    assignments: [],
    schedules: [],
    verifications: [],
    voucherLeads: [],
    assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
    scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
  });

  useEffect(() => {
    let active = true;

    async function load() {
      const cached = readCache();

      if (cached && active) {
          setState({
            loading: false,
            error: "",
          stats: cached.stats || null,
          recentLectures: cached.recentLectures || [],
          recentLeads: cached.recentLeads || [],
          reports: cached.reports || null,
          leads: cached.leads || [],
          vouchers: cached.vouchers || [],
          payments: cached.payments || [],
          students: cached.students || [],
          parents: cached.parents || [],
          assignments: cached.assignments || [],
          schedules: cached.schedules || [],
          verifications: cached.verifications || [],
          voucherLeads: cached.voucherLeads || [],
          assignmentOptions: cached.assignmentOptions || { teachers: [], students: [], courses: [], subjects: [] },
          scheduleOptions: cached.scheduleOptions || { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
        });
      }

      try {
        const response = await fetch("/api/coordinator/dashboard", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load coordinator dashboard.");
        }

        if (active) {
          writeCache(data);
          setState({
            loading: false,
            error: "",
            stats: data.stats,
            recentLectures: data.recentLectures || [],
            recentLeads: data.recentLeads || [],
            reports: data.reports || null,
            leads: [],
            vouchers: [],
            payments: [],
            students: [],
            parents: [],
            assignments: [],
            schedules: [],
            verifications: [],
            voucherLeads: [],
            assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
            scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
          });
        }

        void Promise.allSettled([
          fetch("/api/coordinator/students", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-students:", payload);
              if (active) setState((current) => ({ ...current, students: payload.items || [] }));
            }),
          fetch("/api/coordinator/parents", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-parents:", payload);
              if (active) setState((current) => ({ ...current, parents: payload.items || [] }));
            }),
          fetch("/api/coordinator/teacher-assignments", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-teacher-assignments", payload);
              if (active) setState((current) => ({ ...current, assignments: payload.items || [], assignmentOptions: payload }));
            }),
          fetch("/api/coordinator/lecture-schedules", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-lecture-schedules", payload);
              if (active) setState((current) => ({ ...current, schedules: payload.items || [], scheduleOptions: payload }));
            }),
          fetch("/api/coordinator/lecture-verifications?status=pending", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-lecture-verifications:pending", payload);
              if (active) setState((current) => ({ ...current, verifications: payload.items || [] }));
            }),
          fetch("/api/coordinator/reports", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-reports", payload);
              if (active) {
                setState((current) => ({ ...current, reports: payload }));
              }
            }),
          fetch("/api/coordinator/registration-leads", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-registration-leads", payload);
              if (active) setState((current) => ({ ...current, leads: payload.items || [] }));
            }),
          fetch("/api/coordinator/fee-vouchers", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-fee-vouchers", payload);
              if (active) setState((current) => ({ ...current, vouchers: payload.items || [], voucherLeads: payload.eligibleLeads || [] }));
            }),
          fetch("/api/coordinator/payments", { cache: "no-store" })
            .then((result) => result.json())
            .then((payload) => {
              writeNamedCache("coordinator-payments", payload);
              if (active) setState((current) => ({ ...current, payments: payload.items || [] }));
            }),
        ]);
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load coordinator dashboard.",
            stats: null,
            recentLectures: [],
            recentLeads: [],
            reports: null,
            leads: [],
            vouchers: [],
            payments: [],
            students: [],
            parents: [],
            assignments: [],
            schedules: [],
            verifications: [],
            voucherLeads: [],
            assignmentOptions: { teachers: [], students: [], courses: [], subjects: [] },
            scheduleOptions: { students: [], enrollments: [], subjects: [], teachers: [], items: [] },
          });
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = state.stats || {};
  const reportData = state.reports || null;
  async function refreshTeacherAssignments() {
    const response = await fetch("/api/coordinator/teacher-assignments", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to refresh teacher assignments.");
    }
    setState((current) => ({ ...current, assignments: payload.items || [], assignmentOptions: payload }));
  }

  async function refreshLectureSchedules() {
    const response = await fetch("/api/coordinator/lecture-schedules", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to refresh lecture schedules.");
    }
    setState((current) => ({ ...current, schedules: payload.items || [], scheduleOptions: payload }));
  }

  async function refreshPayments() {
    const response = await fetch("/api/coordinator/payments", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || "Unable to refresh payments.");
    }
    setState((current) => ({ ...current, payments: payload.items || [] }));
  }
  const filteredLeads = state.leads
    .filter((lead) => {
      const search = leadFilter.search.trim().toLowerCase();
      const status = leadFilter.status.trim().toLowerCase();
      const leadStatus = String(lead.status || "").toLowerCase();
      const haystack = [
        lead.student_name,
        lead.parent_name,
        lead.class_level,
        lead.email,
        lead.phone,
      ].join(" ").toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = !status || leadStatus === status;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const filteredVouchers = state.vouchers
    .filter((voucher) => {
      const search = voucherFilter.search.trim().toLowerCase();
      const status = voucherFilter.status.trim().toLowerCase();
      const haystack = [
        voucher.voucher_no,
        voucher.student_name,
        voucher.parent_name,
        voucher.phone,
        voucher.email,
        voucher.amount,
      ].join(" ").toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesStatus = !status || String(voucher.status || "").toLowerCase() === status;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="space-y-6">
      <CoordinatorPortalNavbar />
      <CoordinatorPortalSection
        id="dashboard"
        title="Dashboard"
        description="Monitor intake, payments, access approvals, teacher activity, and lecture scheduling from one coordinated portal."
        showBrand={true}
      >
      </CoordinatorPortalSection>

      {state.error ? (
        <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {state.error}
        </section>
      ) : null}

      <CoordinatorPortalSection
        id="summary"
        title="Coordinator Summary"
        description="Key operational counts in the same compact card style used across the portal."
        showBrand={false}
      >
        <CoordinatorStatsCards
          items={[
            { key: "newLeads", label: "New leads", value: state.loading ? "..." : stats.newLeads || 0 },
            { key: "pendingVouchers", label: "Pending vouchers", value: state.loading ? "..." : stats.pendingVouchers || 0 },
            { key: "pendingPaymentVerifications", label: "Pending payment verifications", value: state.loading ? "..." : stats.pendingPaymentVerifications || 0 },
            { key: "activeStudents", label: "Active students", value: state.loading ? "..." : stats.activeStudents || 0 },
            { key: "lectureNeedsApproval", label: "Lecture needs approval", value: state.loading ? "..." : stats.lectureNeedsApproval || 0 },
          ]}
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection
        id="registration-leads"
        title="Registration Leads"
        description="Latest intake and pipeline summary."
        showBrand={false}
      >
        <div className="space-y-4">
          <RegistrationLeadFilters
            initialSearch={leadFilter.search}
            initialStatus={leadFilter.status}
            canSync={true}
            onFilterChange={(next) => setLeadFilter(next)}
          />
          <ShowMoreSection
            items={filteredLeads}
            renderItems={(visibleItems) => <RegistrationLeadTable leads={visibleItems} />}
            emptyMessage="No registration leads match the current filters."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="fee-vouchers" title="Fee Vouchers" description="Billing and voucher issuance." showBrand={false}>
        <div className="space-y-4">
          <FeeVoucherFilters
            initialSearch={voucherFilter.search}
            initialStatus={voucherFilter.status}
            onFilterChange={(next) => setVoucherFilter(next)}
          />
          <FeeVoucherForm leads={state.leads} />
          <ShowMoreSection
            items={filteredVouchers}
            renderItems={(visibleItems) => <FeeVoucherTable vouchers={visibleItems} />}
            emptyMessage="No fee vouchers match the current filters."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="payments" title="Payments" description="Verification queue." showBrand={false}>
        <ShowMoreSection
          items={state.payments}
          renderItems={(visibleItems) => (
            <PaymentVerificationTable items={visibleItems} onRefresh={() => void refreshPayments()} />
          )}
          emptyMessage="No payment submissions match the current filter."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="students" title="Students" description="Learner registry." showBrand={false}>
        <ShowMoreSection
          items={state.students}
          renderItems={(visibleItems) => <StudentTable items={visibleItems} />}
          emptyMessage="No student records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="parents" title="Parents" description="Family registry." showBrand={false}>
        <ShowMoreSection
          items={state.parents}
          renderItems={(visibleItems) => <ParentTable items={visibleItems} />}
          emptyMessage="No parent records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="teacher-assignments" title="Teacher Assignments" description="Assignment workspace." showBrand={false}>
        <div className="space-y-4">
          <TeacherAssignmentForm
            options={state.assignmentOptions}
            onSuccess={() => {
              void refreshTeacherAssignments();
            }}
          />
          <ShowMoreSection
            items={state.assignments}
            renderItems={(visibleItems) => <TeacherAssignmentTable items={visibleItems} onRefresh={() => void refreshTeacherAssignments()} />}
            emptyMessage="No teacher assignments available."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="lecture-scheduler" title="Lecture Scheduler" description="Scheduling workspace." showBrand={false}>
        <div className="space-y-4">
          <LectureScheduleForm
            options={state.scheduleOptions}
            onSuccess={() => {
              void refreshLectureSchedules();
            }}
          />
          <ShowMoreSection
            items={state.schedules}
            renderItems={(visibleItems) => <LectureScheduleTable items={visibleItems} onRefresh={() => void refreshLectureSchedules()} />}
            emptyMessage="No lecture schedules available."
          />
        </div>
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="lecture-verification" title="Lecture Verification" description="Verification queue." showBrand={false}>
        <ShowMoreSection
          items={state.verifications}
          renderItems={(visibleItems) => <LectureVerificationTable items={visibleItems} />}
          emptyMessage="No lecture verification records available."
        />
      </CoordinatorPortalSection>

      <CoordinatorPortalSection id="reports" title="Reports" description="Operational reports." showBrand={false}>
        <CoordinatorReportsPanel data={reportData || state.recentReportData || {}} />
      </CoordinatorPortalSection>
      <CoordinatorGoTopButton />
    </div>
  );
}
