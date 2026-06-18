import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import FeeVoucherFilters from "@/components/coordinator/FeeVoucherFilters";
import FeeVoucherForm from "@/components/coordinator/FeeVoucherForm";
import FeeVoucherTable from "@/components/coordinator/FeeVoucherTable";
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
      LOWER(status::text) AS status
    FROM registration_leads
    WHERE LOWER(status::text) IN (${Prisma.join([...ELIGIBLE_LEAD_STATUSES])})
    ORDER BY created_at DESC NULLS LAST, id DESC
  `;
}

async function getVouchers(status, search) {
  const conditions = [];

  if (status && VALID_VOUCHER_STATUSES.has(status)) {
    conditions.push(Prisma.sql`LOWER(fv.status::text) = ${status}`);
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      Prisma.sql`(
        fv.voucher_no ILIKE ${term}
        OR rl.student_name ILIKE ${term}
        OR rl.parent_name ILIKE ${term}
        OR rl.phone ILIKE ${term}
        OR rl.email ILIKE ${term}
      )`
    );
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  return prisma.$queryRaw`
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
    ORDER BY fv.due_date ASC NULLS LAST, fv.id DESC
  `;
}

export const dynamic = "force-dynamic";

export default async function CoordinatorFeeVouchersPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    redirect("/login");
  }

  if (!ALLOWED_ROLES.has(role)) {
    redirect(roleToDashboard[role] || "/");
  }

  const resolvedParams = await searchParams;
  const search = normalizeText(resolvedParams?.search);
  const status = normalizeText(resolvedParams?.status).toLowerCase();

  let eligibleLeads = [];
  let vouchers = [];
  let loadError = null;

  try {
    [eligibleLeads, vouchers] = await Promise.all([
      getEligibleLeads(),
      getVouchers(status, search),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load fee vouchers.";
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
              Coordinator billing
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Fee vouchers
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Create payable fee vouchers from eligible registration leads and track issued vouchers before payment proof and verification workflows begin.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {vouchers.length} vouchers loaded
          </div>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {loadError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex-1">
          <FeeVoucherFilters
            initialSearch={search}
            initialStatus={VALID_VOUCHER_STATUSES.has(status) ? status : ""}
          />
        </div>

        <FeeVoucherForm leads={eligibleLeads} />
      </div>

      <FeeVoucherTable vouchers={vouchers} />
    </div>
  );
}
