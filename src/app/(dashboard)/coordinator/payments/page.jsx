import { Prisma } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import PaymentVerificationTable from "@/components/coordinator/PaymentVerificationTable";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

const FILTER_TO_DB_STATUS = {
  pending: "pending",
  verified: "verified",
  rejected: "rejected",
};

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function buildProofPreviewUrl(proofFilePath, proofFileUrl) {
  if (proofFileUrl) {
    return proofFileUrl;
  }

  const supabaseUrl = normalizeText(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const normalizedPath = normalizeText(proofFilePath);

  if (!supabaseUrl || !normalizedPath) {
    return "";
  }

  const objectPath = normalizedPath.replace(/^payment_proofs\//, "");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/payment_proofs/${objectPath}`;
}

async function getCounts() {
  // 🟢 FIXED: Explicit fallback to lowercase identifier strings with direct native casting
  try {
    const [pendingRows, verifiedRows, rejectedRows] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM "fee_submissions" WHERE "status"::text = 'rejected'`,
    ]);

    return {
      pending: Number(pendingRows?.[0]?.total || 0),
      verified: Number(verifiedRows?.[0]?.total || 0),
      rejected: Number(rejectedRows?.[0]?.total || 0),
    };
  } catch (error) {
    console.error("Count query error fallback triggered:", error);
    return { pending: 0, verified: 0, rejected: 0 };
  }
}

async function getItems(status) {
  const conditions = [];
  const dbStatus = FILTER_TO_DB_STATUS[status] || "";

  if (dbStatus) {
    conditions.push(Prisma.sql`fs."status"::text = ${dbStatus}`);
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT
      fs."id"::text AS id,
      fs."payer_name",
      fs."transaction_id",
      fs."paid_amount",
      fs."paid_at",
      fs."proof_file_path",
      fs."status"::text AS status,
      fv."id"::text AS fee_voucher_id,
      fv."voucher_no",
      fv."amount" AS voucher_amount,
      fv."status"::text AS voucher_status,
      rl."id"::text AS registration_lead_id,
      rl."student_name",
      rl."parent_name",
      rl."email",
      rl."phone"
    FROM "fee_submissions" fs
    INNER JOIN "fee_vouchers" fv ON fv."id" = fs."voucher_id"
    INNER JOIN "registration_leads" rl ON rl."id" = fv."registration_id"
    ${whereClause}
    ORDER BY fs."paid_at" DESC NULLS LAST, fs."id" DESC
  `;

  return Promise.all(
    rows.map(async (item) => ({
      ...item,
      status: normalizeStatus(item.status),
      // 🟢 FIXED: Convert Decimal object to plain JavaScript Number/String
      paid_amount: item.paid_amount ? Number(item.paid_amount) : 0,
      voucher_amount: item.voucher_amount ? Number(item.voucher_amount) : 0,
      proof_file_url: buildProofPreviewUrl(
        item.proof_file_path,
        item.proof_file_path ? await createSignedPaymentProofUrl(item.proof_file_path) : ""
      ),
    }))
  );
}

function StatusChip({ label, active }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
      {label}
    </span>
  );
}

export const dynamic = "force-dynamic";

export default async function CoordinatorPaymentsPage({ searchParams }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    redirect("/login");
  }

  if (!ALLOWED_ROLES.has(role)) {
    redirect(roleToDashboard[role] || "/");
  }

  const resolvedParams = await searchParams;
  const status = normalizeStatus(resolvedParams?.status);
  const [counts, items] = await Promise.all([getCounts(), getItems(status)]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Coordinator verification
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Payment verification
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Review voucher payments, confirm submitted proofs, and unlock LMS access once the transaction is verified.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Pending payments</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{counts.pending}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Verified payments</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{counts.verified}</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.22)]">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-rose-700">Rejected payments</p>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{counts.rejected}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-36px_rgba(15,23,42,0.25)] backdrop-blur-xl sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/coordinator/payments">
            <StatusChip label="All" active={!status} />
          </Link>
          <Link href="/coordinator/payments?status=pending">
            <StatusChip label="Pending" active={status === "pending"} />
          </Link>
          <Link href="/coordinator/payments?status=verified">
            <StatusChip label="Verified" active={status === "verified"} />
          </Link>
          <Link href="/coordinator/payments?status=rejected">
            <StatusChip label="Rejected" active={status === "rejected"} />
          </Link>
        </div>
      </section>

      <PaymentVerificationTable items={items} />
    </div>
  );
}
