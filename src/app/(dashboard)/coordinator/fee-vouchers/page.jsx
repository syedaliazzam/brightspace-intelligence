import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import CoordinatorPortalNavbar from "@/components/coordinator/CoordinatorPortalNavbar";
import FeeVoucherFilters from "@/components/coordinator/FeeVoucherFilters";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import FeeVoucherTable from "@/components/coordinator/FeeVoucherTable";
import ShowMoreSection from "@/components/coordinator/ShowMoreSection";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const VALID_VOUCHER_STATUSES = new Set([
  "unpaid",
  "submitted",
  "verified",
  "rejected",
  "expired",
]);
const ELIGIBLE_LEAD_STATUSES = new Set(["new_lead", "pending_clarification"]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getEligibleLeads() {
  return prisma.$queryRaw`
    SELECT
      id::text AS id,
      student_name,
      parent_name,
      email,
      phone,
      LOWER(status::text) AS status,
      CASE
        WHEN status::text = 'new_lead'
         AND NOT EXISTS (
           SELECT 1
           FROM fee_vouchers fv
           WHERE fv.registration_id = registration_leads.id
         )
        THEN true
        ELSE false
      END AS can_create_voucher
    FROM registration_leads
    WHERE LOWER(status::text) = 'new_lead'
      AND NOT EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = registration_leads.id
      )
    ORDER BY created_at DESC NULLS LAST, id DESC
  `;
}

async function getVouchers(status, search) {
  const conditions = [];
  const values = [];

  if (status && VALID_VOUCHER_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`LOWER(fv.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        COALESCE(fv.voucher_no, '') ILIKE $${values.length}
        OR COALESCE(rl.student_name, '') ILIKE $${values.length}
        OR COALESCE(rl.parent_name, '') ILIKE $${values.length}
        OR COALESCE(rl.phone, '') ILIKE $${values.length}
        OR COALESCE(rl.email, '') ILIKE $${values.length}
        OR fv.amount::text ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  return prisma.$queryRawUnsafe(
    `
    SELECT
      fv.id::text AS id,
      fv.voucher_no,
      fv.amount::text AS amount,
      fv.due_date,
      fv.payment_method,
      fv.payment_instructions,
      LOWER(fv.status::text) AS status,
      rl.id::text AS registration_lead_id,
      rl.student_name,
      rl.parent_name,
      rl.email,
      rl.phone
    FROM fee_vouchers fv
    INNER JOIN registration_leads rl ON rl.id = fv.registration_id
    ${whereClause}
    ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
    `,
    ...values
  );
}

export const dynamic = "force-dynamic";

export default async function CoordinatorFeeVouchersPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  const resolvedParams = await searchParams;
  const search = normalizeText(resolvedParams?.search);
  const status = normalizeText(resolvedParams?.status).toLowerCase();
  const [eligibleLeads, vouchers] = await Promise.all([
    getEligibleLeads(),
    getVouchers(status, search),
  ]);

  return (
    <div className="space-y-6">
      <CoordinatorPortalNavbar profile={session.user} />
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">Fee vouchers</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Voucher creation and tracking</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Create fee vouchers for eligible leads and monitor their payment status.
            </p>
          </div>
          <FeeVoucherForm leads={eligibleLeads} />
        </div>
      </section>

      <FeeVoucherFilters initialSearch={search} initialStatus={status} />
      <ShowMoreSection
        items={vouchers}
        initialCount={10}
        step={10}
        renderItems={(visibleItems) => <FeeVoucherTable vouchers={visibleItems} />}
        emptyMessage="No fee vouchers match the current filters."
      />
    </div>
  );
}
