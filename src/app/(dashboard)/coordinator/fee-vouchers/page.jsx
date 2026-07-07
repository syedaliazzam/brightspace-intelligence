import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import FeeVoucherFilters from "@/components/coordinator/FeeVoucherFilters";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import FeeVoucherTable from "@/components/coordinator/FeeVoucherTable";
import ShowMoreSectionServer from "@/components/coordinator/ShowMoreSectionServer";
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

async function getVouchers(search, status) {
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
        OR COALESCE(fv.payment_method::text, '') ILIKE $${values.length}
        OR COALESCE(fv.payment_instructions, '') ILIKE $${values.length}
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
      pm.bank_name,
      fv.payment_instructions,
      LOWER(fv.status::text) AS status,
      rl.id::text AS registration_lead_id,
      rl.student_name,
      rl.parent_name,
      rl.email,
      rl.phone
    FROM fee_vouchers fv
    INNER JOIN registration_leads rl ON rl.id = fv.registration_id
    LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
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
  const statusParam = normalizeText(resolvedParams?.status).toLowerCase();
  const status = statusParam === "all" ? "" : statusParam || "unpaid";
  const page = Number(resolvedParams?.page || 1) || 1;
  const [eligibleLeads, vouchers] = await Promise.all([
    getEligibleLeads(),
    getVouchers(search, status),
  ]);

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              Coordinator portal
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Fee vouchers tracking</h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
              Create fee vouchers for eligible leads and monitor their payment status.
            </p>
          </div>
          <FeeVoucherForm leads={eligibleLeads} showTrigger={false} />
        </div>
      </section>

      <FeeVoucherFilters initialSearch={search} initialStatus={status} />
      <ShowMoreSectionServer
        items={vouchers}
        page={page}
        pageSize={7}
        renderItems={(visibleItems) => <FeeVoucherTable vouchers={visibleItems} />}
        emptyMessage="No fee vouchers match the current filters."
        hrefBase="/coordinator/fee-vouchers"
      />
      </div>
    </div>
  );
}
