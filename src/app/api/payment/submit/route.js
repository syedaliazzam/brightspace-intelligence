import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { uploadPaymentProof } from "@/lib/supabaseStorage";

const SUBMITTABLE_VOUCHER_STATUSES = new Set(["unpaid", "rejected"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePaidAt(value) {
  const trimmed = normalizeText(value);

  if (!trimmed) {
    return "";
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const voucherNo = normalizeText(formData.get("voucherNo"));
    const payerName = normalizeText(formData.get("payerName"));
    const transactionId = normalizeText(formData.get("transactionId"));
    const paidAmount = Number(formData.get("paidAmount"));
    const paidAt = normalizePaidAt(formData.get("paidAt"));
    const proofFile = formData.get("proofFile");

    if (!voucherNo) {
      return json("Voucher number is required.", 400);
    }

    if (!payerName) {
      return json("Payer name is required.", 400);
    }

    if (!transactionId) {
      return json("Transaction ID is required.", 400);
    }

    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return json("Paid amount must be greater than zero.", 400);
    }

    if (!paidAt) {
      return json("Valid paid date is required.", 400);
    }

    if (!(proofFile instanceof File) || !proofFile.size) {
      return json("Payment proof file is required.", 400);
    }

    const [voucher] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      WHERE fv.voucher_no = ${voucherNo}
      LIMIT 1
    `;

    if (!voucher?.id) {
      return json("Voucher not found.", 404);
    }

    if (!SUBMITTABLE_VOUCHER_STATUSES.has(String(voucher.status || "").toLowerCase())) {
      return json("This voucher is not accepting payment submissions.", 400);
    }

    const upload = await uploadPaymentProof({
      voucherNo,
      file: proofFile,
    });

    const item = await prisma.$transaction(async (tx) => {
      const submissionId = crypto.randomUUID();

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
          ${voucher.id}::uuid,
          ${payerName},
          ${transactionId},
          ${paidAmount},
          ${paidAt}::timestamp,
          ${upload.storedPath},
          'pending'::fee_submission_status
        )
      `;

      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET status = ${"submitted"}::voucher_status
        WHERE id = ${voucher.id}::uuid
      `;

      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = ${"fee_submitted"}::registration_status
        WHERE id = ${voucher.registration_lead_id}::uuid
      `;

      const [created] = await tx.$queryRaw`
        SELECT
          v.status::text AS voucher_status,
          fs.id,
          fs.payer_name,
          fs.paid_amount,
          fs.proof_file_path
        FROM fee_vouchers v
        LEFT JOIN fee_submissions fs ON fs.voucher_id = v.id
        WHERE v.id = ${voucher.id}::uuid
        LIMIT 1
      `;

      return created;
    });

    return json("Payment proof submitted.", 201, { item });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to submit payment proof.",
      500
    );
  }
}
