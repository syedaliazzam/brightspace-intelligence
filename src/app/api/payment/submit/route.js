import crypto from "crypto";
import { Prisma } from "@prisma/client";
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

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      dataType: row.data_type,
      udtName: row.udt_name,
    };
    return accumulator;
  }, {});
}

function getValueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }

  if (columnMeta.udtName === "uuid") {
    return Prisma.sql`${value}::uuid`;
  }

  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }

  if (columnMeta.dataType === "json" || columnMeta.dataType === "jsonb") {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.dataType)}`;
  }

  return Prisma.sql`${value}`;
}

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  if (name === "paid_at") {
    values.push(Prisma.sql`${value}::timestamp`);
    return;
  }

  values.push(getValueSql(columnMap[name], value));
}

function ensureSupportedRequiredColumns(tableName, columns, supportedColumns) {
  const missing = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (missing.length) {
    throw new Error(
      `${tableName} requires unsupported columns: ${missing.join(", ")}.`
    );
  }
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
      const columns = await getTableColumns("fee_submissions", tx);
      const insertColumns = [];
      const insertValues = [];
      const supportedColumns = new Set();
      const submissionId = crypto.randomUUID();

      if (columns.id) {
        addColumn(insertColumns, insertValues, columns, "id", submissionId);
        supportedColumns.add("id");
      }
      if (columns.voucher_id) {
        addColumn(insertColumns, insertValues, columns, "voucher_id", voucher.id);
        supportedColumns.add("voucher_id");
      }
      if (columns.payer_name) {
        addColumn(insertColumns, insertValues, columns, "payer_name", payerName);
        supportedColumns.add("payer_name");
      }
      if (columns.transaction_id) {
        addColumn(insertColumns, insertValues, columns, "transaction_id", transactionId);
        supportedColumns.add("transaction_id");
      }
      if (columns.paid_amount) {
        addColumn(insertColumns, insertValues, columns, "paid_amount", paidAmount);
        supportedColumns.add("paid_amount");
      }
      if (columns.paid_at) {
        addColumn(insertColumns, insertValues, columns, "paid_at", paidAt);
        supportedColumns.add("paid_at");
      }
      if (columns.proof_file_path) {
        addColumn(insertColumns, insertValues, columns, "proof_file_path", upload.storedPath);
        supportedColumns.add("proof_file_path");
      }
      if (columns.status) {
        addColumn(insertColumns, insertValues, columns, "status", Prisma.sql`submitted::fee_submission_status`);
        supportedColumns.add("status");
      }

      ensureSupportedRequiredColumns("fee_submissions", columns, supportedColumns);

      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO fee_submissions (${Prisma.join(insertColumns, ", ")})
          VALUES (${Prisma.join(insertValues, ", ")})
        `
      );

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
