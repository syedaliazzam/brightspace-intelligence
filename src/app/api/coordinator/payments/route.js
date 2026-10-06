import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

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
  const whereClause = filter === "monthly"
    ? `WHERE fv.registration_id IS NULL AND fs.id IS NOT NULL`
    : dbStatus
      ? `WHERE fs."status"::text = $1`
      : "";
  const values = dbStatus ? [dbStatus] : [];

  try {
    // 🟢 FIXED: Safe enum casting and exact string mapping
    const [pendingRow, verifiedRow, rejectedRow, monthlyRow, items] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'verified'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE "status"::text = 'rejected'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_vouchers WHERE registration_id IS NULL`,
      prisma.$queryRawUnsafe(
        `
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
          COALESCE(fv.admission_fee_amount, 0) AS admission_fee_amount,
          COALESCE(fv.regular_fee_amount, 0) AS regular_fee_amount,
          COALESCE(fv.discount_amount, 0) AS discount_amount,
          COALESCE(NULLIF(fv.scholarship_amount, 0), student_scholarship.scholarship_amount, 0) AS scholarship_amount,
          fv.status::text AS voucher_status,
          CASE WHEN fv.registration_id IS NULL THEN true ELSE false END AS is_monthly_voucher,
          rl.id::text AS registration_lead_id,
          CASE
            WHEN fv.registration_id IS NULL THEN COALESCE(su.full_name, '')
            ELSE COALESCE(rl.student_name, item.student_name, '')
          END AS student_name,
          COALESCE(
            NULLIF(TRIM(pu.full_name), ''),
            NULLIF(TRIM(pu_by_email.full_name), ''),
            NULLIF(TRIM(rl.parent_name), ''),
            NULLIF(TRIM(item.parent_name), ''),
            ''
          ) AS parent_name,
          COALESCE(
            NULLIF(TRIM(pu.email), ''),
            NULLIF(TRIM(pu_by_email.email), ''),
            NULLIF(TRIM(item.parent_email), ''),
            NULLIF(TRIM(rl.email), ''),
            ''
          ) AS email,
          COALESCE(
            NULLIF(TRIM(pu.phone), ''),
            NULLIF(TRIM(pu_by_email.phone), ''),
            NULLIF(TRIM(item.parent_phone), ''),
            NULLIF(TRIM(rl.phone), ''),
            ''
          ) AS phone,
          c.title AS class_title,
          b.id::text AS batch_id
        FROM fee_submissions fs
        INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
        LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
        LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
        LEFT JOIN LATERAL (
          SELECT e.student_id
          FROM enrollments e
          WHERE e.registration_id = fv.registration_id OR e.student_id = item.student_id
          ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, e.id DESC
          LIMIT 1
        ) active_enr ON TRUE
        LEFT JOIN student_profiles sp ON sp.id = COALESCE(item.student_id, active_enr.student_id)
        LEFT JOIN users su ON su.id = sp.user_id
        LEFT JOIN LATERAL (
          SELECT spp.parent_id
          FROM student_parents spp
          WHERE spp.student_id = sp.id
          ORDER BY spp.is_primary DESC, spp.id DESC
          LIMIT 1
        ) primary_parent ON TRUE
        LEFT JOIN parent_profiles pp ON pp.id = primary_parent.parent_id
        LEFT JOIN users pu ON pu.id = pp.user_id
        LEFT JOIN LATERAL (
          SELECT u_parent.full_name, u_parent.email, u_parent.phone
          FROM users u_parent
          INNER JOIN parent_profiles pp_email ON pp_email.user_id = u_parent.id
          WHERE LOWER(u_parent.email) = LOWER(COALESCE(rl.email, item.parent_email, ''))
            AND NULLIF(TRIM(COALESCE(rl.email, item.parent_email, '')), '') IS NOT NULL
          ORDER BY u_parent.id DESC
          LIMIT 1
        ) pu_by_email ON TRUE
        LEFT JOIN LATERAL (
          SELECT nsf.scholarship_amount
          FROM need_based_scholarship_forms nsf
          INNER JOIN fee_vouchers scholarship_voucher ON scholarship_voucher.id = nsf.voucher_id
          WHERE nsf.scholarship_amount > 0
            AND (
              nsf.registration_id = fv.registration_id
              OR scholarship_voucher.student_id = item.student_id
              OR scholarship_voucher.registration_id = fv.registration_id
            )
          ORDER BY nsf.updated_at DESC NULLS LAST, nsf.created_at DESC NULLS LAST, nsf.id DESC
          LIMIT 1
        ) student_scholarship ON TRUE
        LEFT JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
        LEFT JOIN courses c ON c.id = b.class_id
        ${whereClause}
        ORDER BY fs.paid_at DESC NULLS LAST, fs.id DESC
        `,
        ...values
      ),
    ]);

    return json("Coordinator payments fetched.", 200, {
      counts: {
        pending: Number(pendingRow?.[0]?.total || 0),
        verified: Number(verifiedRow?.[0]?.total || 0),
        rejected: Number(rejectedRow?.[0]?.total || 0),
        monthly: Number(monthlyRow?.[0]?.total || 0),
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
