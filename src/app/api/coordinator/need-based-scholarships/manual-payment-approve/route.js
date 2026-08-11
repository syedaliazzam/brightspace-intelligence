import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadPaymentProof } from "@/lib/supabaseStorage";
import { computeFeeHistoryAmounts } from "@/lib/feeHistory";

const ALLOWED_ROLES = new Set(["coordinator", "admin", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const formData = await request.formData();
    const scholarshipFormId = normalizeText(formData.get("scholarshipFormId"));
    const proofFile = formData.get("proofFile");
    const paidAmountInput = Number(formData.get("paidAmount") || 0);

    if (!scholarshipFormId) return json("Scholarship form id is required.", 400);
    if (!(proofFile instanceof File) || !proofFile.size) {
      return json("Payment proof screenshot is required.", 400);
    }

    const [row] = await prisma.$queryRaw`
      SELECT
        nbsf.id::text AS scholarship_form_id,
        nbsf.registration_id::text AS registration_lead_id,
        COALESCE(NULLIF(TRIM(rl.parent_name), ''), NULLIF(TRIM(rl.student_name), ''), 'Parent') AS payer_name,
        COALESCE(NULLIF(TRIM(rl.student_name), ''), 'Student') AS student_name,
        COALESCE(NULLIF(TRIM(rl.email), ''), '') AS email,
        COALESCE(NULLIF(TRIM(rl.phone), ''), '') AS phone,
        fv.id::text AS voucher_id,
        fv.voucher_no,
        fv.amount::float8 AS voucher_amount,
        fv.regular_fee_amount::float8 AS regular_fee_amount,
        fv.admission_fee_amount::float8 AS admission_fee_amount,
        fv.discount_amount::float8 AS discount_amount,
        fv.total_amount::float8 AS total_amount,
        fs.id::text AS payment_submission_id
      FROM need_based_scholarship_forms nbsf
      INNER JOIN registration_leads rl ON rl.id = nbsf.registration_id
      LEFT JOIN fee_vouchers fv ON fv.id = nbsf.voucher_id
      LEFT JOIN LATERAL (
        SELECT fs_inner.id
        FROM fee_submissions fs_inner
        WHERE fs_inner.voucher_id = fv.id
        ORDER BY fs_inner.created_at DESC NULLS LAST, fs_inner.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE nbsf.id = ${scholarshipFormId}::uuid
      LIMIT 1
    `;

    if (!row?.scholarship_form_id) return json("Scholarship record not found.", 404);
    if (!row?.registration_lead_id) return json("Registration lead is not linked for this scholarship record.", 400);
    if (!row?.voucher_id || !row?.voucher_no) return json("Fee voucher not found for this scholarship record.", 400);
    if (row?.payment_submission_id) {
      return json("Payment has already been submitted for this voucher.", 400);
    }

    const submissionPaidAmount = Number.isFinite(paidAmountInput) && paidAmountInput > 0
      ? paidAmountInput
      : Number(row.voucher_amount || row.total_amount || 0);
    const regularFeeAmount = Number(row.regular_fee_amount || 0);
    const admissionFeeAmount = Number(row.admission_fee_amount || 0);
    const discountAmount = Number(row.discount_amount || 0);
    const currentMonthFee = Number(row.total_amount || Math.max(regularFeeAmount + admissionFeeAmount - discountAmount, 0));
    const computedAmounts = computeFeeHistoryAmounts({
      previousMonthDue: 0,
      currentMonthFee,
      thisMonthPaid: submissionPaidAmount,
    });

    const upload = await uploadPaymentProof({
      voucherNo: row.voucher_no,
      file: proofFile,
    });

    const paidAt = new Date().toISOString();
    const transactionId = `manual-scholarship-${Date.now()}`;
    const submissionId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO fee_submissions (
          id,
          voucher_id,
          payer_name,
          transaction_id,
          paid_amount,
          paid_at,
          proof_file_path,
          status
        )
        VALUES (
          ${submissionId}::uuid,
          ${row.voucher_id}::uuid,
          ${row.payer_name},
          ${transactionId},
          ${submissionPaidAmount},
          ${paidAt}::timestamp,
          ${upload.storedPath},
          'pending'::fee_submission_status
        )
      `;

      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET status = 'submitted'::voucher_status
        WHERE id = ${row.voucher_id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = 'fee_submitted'::registration_status
        WHERE id = ${row.registration_lead_id}::uuid
      `;
    });

    const origin = request.nextUrl.origin;
    const verifyResponse = await fetch(`${origin}/api/coordinator/payments/${submissionId}/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({ action: "approve" }),
      cache: "no-store",
    });

    const verifyData = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok) {
      return json(
        verifyData?.message || "Payment record was created, but approval failed. Please approve it from the Payments page.",
        verifyResponse.status || 500,
        { paymentSubmissionId: submissionId }
      );
    }

    const [studentRow] = await prisma.$queryRaw`
      SELECT fv.student_id::text AS student_id
      FROM fee_vouchers fv
      WHERE fv.id = ${row.voucher_id}::uuid
      LIMIT 1
    `;

    if (studentRow?.student_id) {
      await prisma.$executeRaw`
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
          ${studentRow.student_id}::uuid,
          NULL,
          ${row.voucher_id}::uuid,
          ${row.registration_lead_id}::uuid,
          TO_CHAR(NOW(), 'Mon YYYY'),
          NOW()::date,
          ${computedAmounts.previousMonthDue},
          ${discountAmount},
          ${computedAmounts.currentMonthFee},
          ${computedAmounts.totalAmount},
          ${computedAmounts.thisMonthPaid},
          ${computedAmounts.remainingDue},
          NOW(),
          NOW()
        )
        ON CONFLICT (voucher_id) DO UPDATE
        SET
          student_id = EXCLUDED.student_id,
          previous_month_due = EXCLUDED.previous_month_due,
          discount_amount = EXCLUDED.discount_amount,
          current_month_fee = EXCLUDED.current_month_fee,
          total_amount = EXCLUDED.total_amount,
          this_month_paid = EXCLUDED.this_month_paid,
          remaining_due = EXCLUDED.remaining_due,
          updated_at = NOW()
      `;
    }

    return json(
      verifyData?.message || "Payment approved and credentials sent successfully.",
      200,
      {
        success: true,
        paymentSubmissionId: submissionId,
        credentials_email: verifyData?.credentials_email || null,
      }
    );
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to approve scholarship payment.", 500);
  }
}
