import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        nbsf.id::text AS id,
        nbsf.registration_id::text AS registration_id,
        nbsf.interested_student_id::text AS interested_student_id,
        nbsf.lead_token,
        nbsf.dependents_count,
        nbsf.school_going_children_count,
        nbsf.residence_type,
        nbsf.requested_amount::float8 AS requested_amount,
        nbsf.scholarship_reason,
        LOWER(
          COALESCE(
            latest_submission.status::text,
            fv.status::text,
            CASE
              WHEN COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL OR fv.id IS NOT NULL THEN 'voucher_created'
              ELSE nbsf.status::text
            END,
            'submitted'
          )
        ) AS status,
        (COALESCE(nbsf.voucher_created, FALSE) OR nbsf.voucher_id IS NOT NULL OR fv.id IS NOT NULL) AS voucher_created,
        nbsf.voucher_id::text AS scholarship_form_voucher_id,
        fv.id::text AS voucher_id,
        fv.voucher_no,
        LOWER(COALESCE(fv.status::text, '')) AS voucher_status,
        fv.amount::float8 AS voucher_amount,
        fv.total_amount::float8 AS voucher_total_amount,
        fv.regular_fee_amount::float8 AS regular_fee_amount,
        fv.admission_fee_amount::float8 AS admission_fee_amount,
        fv.discount_amount::float8 AS discount_amount,
        fv.scholarship_amount::float8 AS voucher_scholarship_amount,
        fv.due_date,
        latest_submission.id::text AS fee_submission_id,
        (latest_submission.status IS NOT NULL) AS has_fee_submission,
        LOWER(COALESCE(latest_submission.status::text, '')) AS fee_submission_status,
        latest_submission.paid_amount::float8 AS paid_amount,
        EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.registration_id = nbsf.registration_id
             OR (fv.student_id IS NOT NULL AND e.student_id = fv.student_id)
          LIMIT 1
        )
        OR EXISTS (
          SELECT 1
          FROM student_profiles sp_live
          INNER JOIN users u_live ON u_live.id = sp_live.user_id
          LEFT JOIN enrollments e_live ON e_live.student_id = sp_live.id
          WHERE COALESCE(sp_live.status, 'active'::user_status) = 'active'::user_status
            AND COALESCE(u_live.status, 'active'::user_status) = 'active'::user_status
            AND (
              e_live.registration_id = nbsf.registration_id
              OR LOWER(NULLIF(TRIM(u_live.full_name), '')) = LOWER(NULLIF(TRIM(rl.student_name), ''))
              OR (
                NULLIF(TRIM(rl.email), '') IS NOT NULL
                AND LOWER(NULLIF(TRIM(u_live.email), '')) = LOWER(NULLIF(TRIM(rl.email), ''))
              )
              OR (
                NULLIF(TRIM(rl.phone), '') IS NOT NULL
                AND REGEXP_REPLACE(COALESCE(u_live.phone, ''), '\\D', '', 'g') = REGEXP_REPLACE(COALESCE(rl.phone, ''), '\\D', '', 'g')
              )
            )
          LIMIT 1
        )
        OR LOWER(COALESCE(rl.status::text, '')) IN ('access_granted', 'fee_verified') AS is_lms_enrolled,
        COALESCE(nbsf.scholarship_amount::float8, 0) AS scholarship_amount,
        nbsf.created_at,
        nbsf.updated_at,
        rl.student_name,
        rl.parent_name,
        rl.class_level,
        rl.email,
        rl.phone,
        LOWER(COALESCE(rl.status::text, 'new_lead')) AS lead_status
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      LEFT JOIN LATERAL (
        SELECT fv_inner.*
        FROM fee_vouchers fv_inner
        WHERE fv_inner.id = nbsf.voucher_id
           OR (
             nbsf.voucher_id IS NULL
             AND fv_inner.registration_id = nbsf.registration_id
             AND COALESCE(fv_inner.scholarship_amount, 0) > 0
           )
        ORDER BY
          CASE WHEN fv_inner.id = nbsf.voucher_id THEN 0 ELSE 1 END,
          CASE WHEN LOWER(fv_inner.status::text) = 'verified' THEN 0 ELSE 1 END,
          fv_inner.updated_at DESC NULLS LAST,
          fv_inner.created_at DESC NULLS LAST,
          fv_inner.id DESC
        LIMIT 1
      ) fv ON TRUE
      LEFT JOIN LATERAL (
        SELECT fs.id, fs.status, fs.paid_amount
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) latest_submission ON TRUE
      ORDER BY nbsf.created_at DESC NULLS LAST, nbsf.id DESC
    `;

    return json("Scholarship records fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch scholarship records.", 500);
  }
}
