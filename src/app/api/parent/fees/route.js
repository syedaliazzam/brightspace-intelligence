import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedPaymentProofUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const joins = isAdmin ? "" : "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id";
    const where = isAdmin
      ? childId ? "WHERE sp.id = $1::uuid" : ""
      : childId ? "WHERE pp.user_id = $1::uuid AND sp.id = $2::uuid" : "WHERE pp.user_id = $1::uuid";
    const values = isAdmin ? childId ? [childId] : [] : childId ? [session.user.id, childId] : [session.user.id];

    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount::text AS amount,
        fv.due_date,
        fv.payment_method::text AS payment_method,
        fv.status::text AS voucher_status,
        fs.status::text AS submission_status,
        fs.transaction_id,
        fs.paid_amount::text AS paid_amount,
        fs.paid_at,
        fs.proof_file_path,
        su.full_name AS student_name
      FROM student_profiles sp
      INNER JOIN users su ON su.id = sp.user_id
      ${joins}
      LEFT JOIN LATERAL (
        SELECT
          fv_inner.id,
          fv_inner.voucher_no,
          fv_inner.amount,
          fv_inner.due_date,
          fv_inner.payment_method,
          fv_inner.status,
          fv_inner.created_at
        FROM fee_vouchers fv_inner
        LEFT JOIN registration_leads rl_inner ON LOWER(rl_inner.student_name) = LOWER(su.full_name)
        WHERE fv_inner.student_id = sp.id
           OR (fv_inner.student_id IS NULL AND fv_inner.registration_id = rl_inner.id)
        ORDER BY fv_inner.created_at DESC NULLS LAST, fv_inner.id DESC
        LIMIT 1
      ) fv ON TRUE
      LEFT JOIN LATERAL (
        SELECT fs.status, fs.transaction_id, fs.paid_amount, fs.paid_at, fs.proof_file_path
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC
        LIMIT 1
      ) fs ON TRUE
      ${where}
      ORDER BY fv.created_at DESC NULLS LAST
      `,
      ...values
    );

    const signedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        proof_url: item.proof_file_path
          ? await createSignedPaymentProofUrl(item.proof_file_path).catch(() => "")
          : "",
      }))
    );

    return json("Fees fetched.", 200, { items: signedItems });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load fees.", 500);
  }
}
