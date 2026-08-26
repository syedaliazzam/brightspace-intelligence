import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const body = await request.json();
    const scholarshipFormId = normalizeText(body?.scholarshipFormId);
    const regularFeeAmount = normalizeMoney(body?.regularFeeAmount);
    const admissionFeeAmount = normalizeMoney(body?.admissionFeeAmount);
    const discountAmount = normalizeMoney(body?.discountAmount);
    const scholarshipAmount = normalizeMoney(body?.scholarshipAmount);
    const totalPayableInput = normalizeMoney(body?.totalPayable);
    const paidAmountInput = normalizeMoney(body?.paidAmount);
    const computedTotalPayable = Math.max(regularFeeAmount + admissionFeeAmount - discountAmount - scholarshipAmount, 0);
    const totalPayable = totalPayableInput > 0 ? totalPayableInput : computedTotalPayable;

    if (!scholarshipFormId) return json("Scholarship form id is required.", 400);

    const [record] = await prisma.$queryRaw`
      SELECT
        nbsf.id::text AS scholarship_form_id,
        nbsf.registration_id::text AS registration_id,
        nbsf.voucher_id::text AS linked_voucher_id,
        COALESCE(NULLIF(TRIM(rl.student_name), ''), 'Student') AS student_name,
        fv.id::text AS voucher_id,
        fv.voucher_no,
        fv.student_id::text AS voucher_student_id,
        COALESCE(fs.paid_amount::float8, 0) AS stored_paid_amount
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      LEFT JOIN LATERAL (
        SELECT fv_inner.*
        FROM fee_vouchers fv_inner
        WHERE COALESCE(fv_inner.registration_id, fv_inner.registration_lead_id) = nbsf.registration_id
          AND NOT EXISTS (
            SELECT 1
            FROM regular_monthly_fee_voucher_items monthly_item
            WHERE monthly_item.voucher_id = fv_inner.id
          )
        ORDER BY
          CASE WHEN fv_inner.id = nbsf.voucher_id THEN 0 ELSE 1 END,
          CASE WHEN LOWER(fv_inner.status::text) = 'verified' THEN 0 ELSE 1 END,
          fv_inner.created_at DESC NULLS LAST,
          fv_inner.id DESC
        LIMIT 1
      ) fv ON TRUE
      LEFT JOIN LATERAL (
        SELECT fs_inner.paid_amount
        FROM fee_submissions fs_inner
        WHERE fs_inner.voucher_id = fv.id
        ORDER BY fs_inner.created_at DESC NULLS LAST, fs_inner.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE nbsf.id = ${scholarshipFormId}::uuid
      LIMIT 1
    `;

    if (!record?.scholarship_form_id) return json("Scholarship record not found.", 404);
    if (!record?.voucher_id) return json("Admission voucher not found for this scholarship record.", 404);

    const [student] = record.voucher_student_id
      ? [{ student_id: record.voucher_student_id }]
      : await prisma.$queryRaw`
          SELECT e.student_id::text AS student_id
          FROM enrollments e
          WHERE e.registration_id = ${record.registration_id}::uuid
          ORDER BY e.created_at DESC NULLS LAST, e.id DESC
          LIMIT 1
        `;

    const paidAmount = paidAmountInput > 0 ? paidAmountInput : normalizeMoney(record.stored_paid_amount);
    const remainingDue = Math.max(totalPayable - paidAmount, 0);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE need_based_scholarship_forms
        SET
          voucher_id = ${record.voucher_id}::uuid,
          voucher_created = TRUE,
          scholarship_amount = ${scholarshipAmount},
          updated_at = NOW()
        WHERE id = ${scholarshipFormId}::uuid
      `;

      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET
          regular_fee_amount = ${regularFeeAmount},
          admission_fee_amount = ${admissionFeeAmount},
          discount_amount = ${discountAmount},
          scholarship_amount = ${scholarshipAmount},
          subtotal_amount = ${regularFeeAmount + admissionFeeAmount},
          amount = ${totalPayable},
          total_amount = ${totalPayable},
          scholarship_form_id = ${scholarshipFormId}::uuid,
          updated_at = NOW()
        WHERE id = ${record.voucher_id}::uuid
      `;

      if (student?.student_id) {
        await tx.$executeRaw`
          INSERT INTO fee_history_records (
            id,
            student_id,
            batch_id,
            voucher_id,
            registration_id,
            month_label,
            due_date,
            previous_month_due,
            discount_amount,
            current_month_fee,
            total_amount,
            this_month_paid,
            remaining_due,
            created_at,
            updated_at
          )
          VALUES (
            gen_random_uuid(),
            ${student.student_id}::uuid,
            NULL,
            ${record.voucher_id}::uuid,
            ${record.registration_id}::uuid,
            TO_CHAR(NOW(), 'Mon YYYY'),
            NOW()::date,
            0,
            ${discountAmount},
            ${totalPayable},
            ${totalPayable},
            ${paidAmount},
            ${remainingDue},
            NOW(),
            NOW()
          )
          ON CONFLICT (voucher_id) DO UPDATE
          SET
            student_id = EXCLUDED.student_id,
            registration_id = EXCLUDED.registration_id,
            previous_month_due = EXCLUDED.previous_month_due,
            discount_amount = EXCLUDED.discount_amount,
            current_month_fee = EXCLUDED.current_month_fee,
            total_amount = EXCLUDED.total_amount,
            this_month_paid = EXCLUDED.this_month_paid,
            remaining_due = EXCLUDED.remaining_due,
            updated_at = NOW()
        `;
      }
    });

    return json("Scholarship voucher updated successfully.", 200, {
      success: true,
      voucherId: record.voucher_id,
      voucherNo: record.voucher_no,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update scholarship voucher.", 500);
  }
}
