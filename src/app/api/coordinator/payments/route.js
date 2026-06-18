import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

// DB status enum se complete sync: 'pending' mapping strictly managed
const FILTER_TO_DB_STATUS = {
  pending: "pending",
  verified: "verified",
  rejected: "rejected",
};

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function addSignedUrls(items) {
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      proof_file_url: item.proof_file_path
        ? await createSignedPaymentProofUrl(item.proof_file_path)
        : "",
    }))
  );
}

export async function GET(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  const { searchParams } = new URL(request.url);
  const filter = normalizeText(searchParams.get("status")).toLowerCase();
  const dbStatus = FILTER_TO_DB_STATUS[filter] || "";
  const conditions = [];

  if (dbStatus) {
    conditions.push(Prisma.sql`fs."status"::text = ${dbStatus}`);
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  try {
    // 🟢 FIXED: Safe enum casting and exact string mapping
    const [pendingRow, verifiedRow, rejectedRow, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'rejected'`,
      prisma.$queryRaw`
        SELECT
          fs.id::text AS id,
          fs.payer_name,
          fs.transaction_id,
          fs.paid_amount,
          fs.paid_at,
          fs.proof_file_path,
          fs."status"::text AS status,
          fv.id::text AS fee_voucher_id,
          fv.voucher_no,
          fv.amount AS voucher_amount,
          fv.status::text AS voucher_status,
          rl.id::text AS registration_lead_id,
          rl.student_name,
          rl.parent_name,
          rl.email,
          rl.phone
        FROM fee_submissions fs
        INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
        INNER JOIN registration_leads rl ON rl.id = fv.registration_id
        ${whereClause}
        ORDER BY fs.paid_at DESC NULLS LAST, fs.id DESC
      `,
    ]);

    return json("Coordinator payments fetched.", 200, {
      counts: {
        pending: Number(pendingRow?.[0]?.total || 0),
        verified: Number(verifiedRow?.[0]?.total || 0),
        rejected: Number(rejectedRow?.[0]?.total || 0),
      },
      items: await addSignedUrls(items),
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch payment submissions.",
      500
    );
  }
}
