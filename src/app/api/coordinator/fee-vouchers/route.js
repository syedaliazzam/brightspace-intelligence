import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildFeeVoucherEmailHtml, sendEmail, getAppUrl } from "@/lib/email";
import prisma from "@/lib/prisma";
import { generateVoucherNumber } from "@/lib/voucherNumber";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const ELIGIBLE_LEAD_STATUSES = new Set(["new_lead", "pending_clarification"]);
const VALID_VOUCHER_STATUSES = new Set([
  "unpaid",
  "submitted",
  "verified",
  "rejected",
  "expired",
]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
    };
    return accumulator;
  }, {});
}

function normalizeEnumValue(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, " ");
}

async function getEnumLabels(typeName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT enumlabel
    FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = ${typeName}
  `;

  return new Set(rows.map((row) => String(row.enumlabel)));
}

const PAYMENT_METHOD_ALIASES = {
  "bank transfer": ["Bank transfer", "bank"],
  bank: ["bank", "Bank transfer"],
  jazzcash: ["JazzCash", "jazzcash"],
  easypaisa: ["EasyPaisa", "easypaisa"],
  "easy paisa": ["EasyPaisa", "easypaisa"],
  "cash deposit": ["Cash deposit", "cash"],
  cash: ["cash", "Cash deposit"],
  other: ["Other", "other"],
};

async function resolvePaymentMethod(value, tx = prisma) {
  const normalized = normalizeEnumValue(value);

  if (!normalized) {
    return "";
  }

  const aliases = PAYMENT_METHOD_ALIASES[normalized] || [value];
  const labels = await getEnumLabels("payment_method", tx);

  for (const candidate of aliases) {
    if (labels.has(candidate)) {
      return candidate;
    }
  }

  return "";
}

async function getCoordinatorMaxDiscountPercent(tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT value::text AS value
    FROM fee_settings
    WHERE key = 'coordinator_max_discount_percent'
    LIMIT 1
  `;

  const parsed = Number(row?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
}

async function getRegularFeeAmount(classLevel, tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT amount::float8 AS amount
    FROM other_fee
    WHERE LOWER(fee_type::text) = 'regular_fee'
      AND LOWER(COALESCE(class_level, '')) = LOWER(${classLevel})
      AND LOWER(status::text) = 'active'
    ORDER BY created_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  return Number(row?.amount || 0);
}

async function getDiscountById(discountId, tx = prisma) {
  if (!discountId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      label,
      percent::float8 AS percent
    FROM discounts
    WHERE id = ${discountId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function getOtherFeeById(otherFeeId, tx = prisma) {
  if (!otherFeeId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      COALESCE(name, title) AS name,
      fee_type,
      class_level,
      amount::float8 AS amount,
      LOWER(status::text) AS status
    FROM other_fee
    WHERE id = ${otherFeeId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

async function getPaymentMethodById(paymentMethodId, tx = prisma) {
  if (!paymentMethodId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      name,
      method_key,
      account_title,
      account_number,
      iban,
      bank_name,
      branch_code,
      instructions,
      LOWER(status::text) AS status
    FROM payment_methods
    WHERE id = ${paymentMethodId}::uuid
      AND LOWER(status::text) = 'active'
    LIMIT 1
  `;

  return row || null;
}

function addColumn(columns, values, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(value);
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

async function insertAuditLog(actorUserId, entityId, action, description, metadata = {}, tx = prisma) {
  const columns = await getTableColumns("audit_logs", tx);

  if (!Object.keys(columns).length) {
    return;
  }

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", crypto.randomUUID());
    supportedColumns.add("id");
  }
  if (columns.actor_user_id) {
    addColumn(insertColumns, insertValues, "actor_user_id", actorUserId);
    supportedColumns.add("actor_user_id");
  }
  if (columns.entity_type) {
    addColumn(insertColumns, insertValues, "entity_type", "fee_vouchers");
    supportedColumns.add("entity_type");
  }
  if (columns.entity_id) {
    addColumn(insertColumns, insertValues, "entity_id", entityId);
    supportedColumns.add("entity_id");
  }
  if (columns.action) {
    addColumn(insertColumns, insertValues, "action", action);
    supportedColumns.add("action");
  }
  if (columns.description) {
    addColumn(insertColumns, insertValues, "description", description);
    supportedColumns.add("description");
  }
  if (columns.metadata) {
    addColumn(insertColumns, insertValues, "metadata", JSON.stringify(metadata));
    supportedColumns.add("metadata");
  }
  if (columns.meta) {
    addColumn(insertColumns, insertValues, "meta", JSON.stringify(metadata));
    supportedColumns.add("meta");
  }

  ensureSupportedRequiredColumns("audit_logs", columns, supportedColumns);

  if (!insertColumns.length) {
    return;
  }

  await tx.$executeRaw`
    INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((v) =>
        typeof v === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
          ? Prisma.sql`${v}::uuid`
          : Prisma.sql`${v}`
      ),
      ", "
    )})
  `;
}

function normalizeDueDate(value) {
  const trimmed = normalizeText(value);

  if (!trimmed) {
    return "";
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

async function getLeadById(id, tx = prisma) {
  const [lead] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      student_name,
      parent_name,
      class_level,
      email,
      phone,
      LOWER(status::text) AS status
    FROM registration_leads
    WHERE id = ${id}::uuid
    LIMIT 1
  `;

  return lead;
}

async function buildVoucherInsertPayload(voucherNo, payload, tx) {
  const columns = await getTableColumns("fee_vouchers", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const voucherId = crypto.randomUUID();

  if (columns.id) {
    addColumn(insertColumns, insertValues, "id", voucherId);
    supportedColumns.add("id");
  }
  
  // SECURE RELATIONAL BINDING: Ensuring student/lead target connection payload maps perfectly
  if (columns.registration_id) {
    insertColumns.push(Prisma.raw(`"registration_id"`));
    insertValues.push({ value: payload.registrationLeadId, castType: "uuid" });
    supportedColumns.add("registration_id");
  }
  if (columns.voucher_no) {
    addColumn(insertColumns, insertValues, "voucher_no", voucherNo);
    supportedColumns.add("voucher_no");
  }
  if (columns.amount) {
    addColumn(insertColumns, insertValues, "amount", payload.amount);
    supportedColumns.add("amount");
  }
  if (columns.regular_fee_applied) {
    addColumn(insertColumns, insertValues, "regular_fee_applied", payload.regularFeeApplied ? true : false);
    supportedColumns.add("regular_fee_applied");
  }
  if (columns.regular_fee_amount) {
    addColumn(insertColumns, insertValues, "regular_fee_amount", payload.regularFeeAmount);
    supportedColumns.add("regular_fee_amount");
  }
  if (columns.admission_fee_amount) {
    addColumn(insertColumns, insertValues, "admission_fee_amount", payload.admissionFeeAmount);
    supportedColumns.add("admission_fee_amount");
  }
  if (columns.other_fee_id && payload.otherFeeId) {
    insertColumns.push(Prisma.raw(`"other_fee_id"`));
    insertValues.push({ value: payload.otherFeeId, castType: "uuid" });
    supportedColumns.add("other_fee_id");
  }
  if (columns.discount_id) {
    insertColumns.push(Prisma.raw(`"discount_id"`));
    insertValues.push(payload.discountId ? { value: payload.discountId, castType: "uuid" } : null);
    supportedColumns.add("discount_id");
  }
  if (columns.discount_percent) {
    addColumn(insertColumns, insertValues, "discount_percent", payload.discountPercent);
    supportedColumns.add("discount_percent");
  }
  if (columns.subtotal_amount) {
    addColumn(insertColumns, insertValues, "subtotal_amount", payload.subtotalAmount);
    supportedColumns.add("subtotal_amount");
  }
  if (columns.discount_amount) {
    addColumn(insertColumns, insertValues, "discount_amount", payload.discountAmount);
    supportedColumns.add("discount_amount");
  }
  if (columns.total_amount) {
    addColumn(insertColumns, insertValues, "total_amount", payload.totalAmount);
    supportedColumns.add("total_amount");
  }
  if (columns.due_date) {
    addColumn(insertColumns, insertValues, "due_date", new Date(payload.dueDate));
    supportedColumns.add("due_date");
  }
  if (columns.payment_method_id && payload.paymentMethodId) {
    insertColumns.push(Prisma.raw(`"payment_method_id"`));
    insertValues.push({ value: payload.paymentMethodId, castType: "uuid" });
    supportedColumns.add("payment_method_id");
  } else if (columns.payment_method) {
    insertColumns.push(Prisma.raw(`"payment_method"`));
    insertValues.push({ value: payload.paymentMethod, castType: "payment_method" });
    supportedColumns.add("payment_method");
  }
  if (columns.payment_instructions) {
    addColumn(
      insertColumns,
      insertValues,
      "payment_instructions",
      payload.paymentInstructions || null
    );
    supportedColumns.add("payment_instructions");
  }
  if (columns.status) {
    insertColumns.push(Prisma.raw(`"status"`));
    insertValues.push({ value: "unpaid", castType: "voucher_status" });
    supportedColumns.add("status");
  }
  if (columns.created_by_user_id) {
    addColumn(insertColumns, insertValues, "created_by_user_id", payload.createdByUserId);
    supportedColumns.add("created_by_user_id");
  }

  ensureSupportedRequiredColumns("fee_vouchers", columns, supportedColumns);

  return { voucherId, insertColumns, insertValues };
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
  const status = normalizeText(searchParams.get("status")).toLowerCase();
  const search = normalizeText(searchParams.get("search"));
  const conditions = [];
  const values = [];

  if (status && VALID_VOUCHER_STATUSES.has(status)) {
    values.push(status);
    conditions.push(`LOWER(fv.status::text) = $${values.length}`);
  }

  if (search) {
    const term = `%${search}%`;
    values.push(term);
    conditions.push(`(
        COALESCE(fv.voucher_no, '') ILIKE $${values.length}
        OR COALESCE(rl.student_name, '') ILIKE $${values.length}
        OR COALESCE(rl.parent_name, '') ILIKE $${values.length}
        OR COALESCE(rl.phone, '') ILIKE $${values.length}
        OR COALESCE(rl.email, '') ILIKE $${values.length}
        OR fv.amount::text ILIKE $${values.length}
      )`);
  }

  const whereClause = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  try {
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
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
      ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
      `,
      ...values
    );

    return json("Fee vouchers fetched.", 200, { items });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch fee vouchers.",
      500
    );
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  try {
    const body = await request.json();
    const registrationLeadId = normalizeText(body?.registration_lead_id || body?.registrationLeadId);
    const regularFeeApplied = normalizeBoolean(body?.regular_fee_applied ?? body?.regularFeeApplied);
    const otherFeeId = normalizeText(body?.other_fee_id ?? body?.otherFeeId);
    const admissionFeeAmountInput = toMoney(body?.admission_fee_amount ?? body?.admissionFeeAmount);
    const discountId = normalizeText(body?.discount_id ?? body?.discountId);
    const discountPercentInput = Number((body?.discount_percent ?? body?.discountPercent) || 0);
    const dueDate = normalizeDueDate(body?.dueDate);
    const paymentMethod = normalizeText(body?.paymentMethod);
    const paymentMethodId = normalizeText(body?.paymentMethodId || body?.payment_method_id);
    const paymentInstructions = normalizeText(body?.paymentInstructions);

    if (!registrationLeadId) {
      return json("Registration lead is required.", 400);
    }

    if (!dueDate) {
      return json("Valid due date is required.", 400);
    }

    if (!paymentMethod && !paymentMethodId) {
      return json("Payment method is required.", 400);
    }

    const [existingVoucher] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
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
      WHERE fv.registration_id = ${registrationLeadId}::uuid
      ORDER BY fv.created_at DESC NULLS LAST, fv.id DESC
      LIMIT 1
    `;

    if (existingVoucher?.id) {
      return json("Fee voucher already exists for this registration lead.", 200, {
        item: existingVoucher,
        existing: true,
      });
    }

    const voucherNo = await generateVoucherNumber();

    const { item, lead } = await prisma.$transaction(async (tx) => {
      const lead = await getLeadById(registrationLeadId, tx);

      if (!lead?.id) {
        throw new Error("Registration lead not found.");
      }

      if (!ELIGIBLE_LEAD_STATUSES.has(String(lead.status || "").toLowerCase())) {
        throw new Error("Fee voucher can only be created for new or clarification-pending leads.");
      }

      const selectedPaymentMethod = await getPaymentMethodById(paymentMethodId, tx);
      const resolvedPaymentMethod = selectedPaymentMethod
        ? selectedPaymentMethod.name || selectedPaymentMethod.method_key
        : await resolvePaymentMethod(paymentMethod, tx);

      if (!resolvedPaymentMethod) {
        throw new Error("Invalid payment method.");
      }

      const selectedOtherFee = await getOtherFeeById(otherFeeId, tx);
      if (otherFeeId && !selectedOtherFee) {
        throw new Error("Selected other fee is not available.");
      }

      const maxDiscountPercent =
        role === "admin" ? 100 : await getCoordinatorMaxDiscountPercent(tx);
      const discount = await getDiscountById(discountId, tx);
      const leadRegularFeeAmount = regularFeeApplied
        ? await getRegularFeeAmount(lead.class_level, tx)
        : 0;
      if (regularFeeApplied && leadRegularFeeAmount <= 0) {
        throw new Error("Regular fee is not available for the selected class.");
      }
      const regularFeeAmount = regularFeeApplied ? leadRegularFeeAmount : 0;
      const admissionFeeAmount = selectedOtherFee
        ? Number(selectedOtherFee.amount || 0)
        : admissionFeeAmountInput;
      const discountPercent = discount ? Number(discount.percent || 0) : Number(discountPercentInput || 0);

      if (role !== "admin" && discountPercent > maxDiscountPercent) {
        throw new Error(`Coordinator can only apply up to ${maxDiscountPercent}% discount.`);
      }

      if (discountPercent < 0 || regularFeeAmount < 0 || admissionFeeAmount < 0) {
        throw new Error("Fee values cannot be negative.");
      }

      const subtotalAmount = Number((regularFeeAmount + admissionFeeAmount).toFixed(2));
      const discountAmount = Number(((subtotalAmount * discountPercent) / 100).toFixed(2));
      const totalAmount = Number((subtotalAmount - discountAmount).toFixed(2));
      if (totalAmount <= 0) {
        throw new Error("Voucher total must be greater than zero.");
      }
      const voucherAmount = totalAmount;

      const payload = {
        registrationLeadId,
        amount: voucherAmount,
        dueDate,
        paymentMethodId: selectedPaymentMethod?.id || null,
        paymentMethod: resolvedPaymentMethod,
        paymentInstructions,
        createdByUserId: session.user.id,
        regularFeeApplied,
        regularFeeAmount,
        otherFeeId: selectedOtherFee?.id || null,
        admissionFeeAmount,
        discountId: discount?.id || null,
        discountPercent,
        subtotalAmount,
        discountAmount,
        totalAmount,
      };
      
      const { voucherId, insertColumns, insertValues } = await buildVoucherInsertPayload(
        voucherNo,
        payload,
        tx
      );

      const insertColumnsJoin = Prisma.join(insertColumns, ", ");
      
      // FIXED: Dynamic cast mapper maps custom database ENUMs & explicit relational IDs safely
      await tx.$executeRaw`
        INSERT INTO fee_vouchers (${insertColumnsJoin})
        VALUES (${Prisma.join(
          insertValues.map((item) => {
            if (item && typeof item === "object" && item.castType) {
              if (item.castType === "payment_method") return Prisma.sql`${item.value}::payment_method`;
              if (item.castType === "voucher_status") return Prisma.sql`${item.value}::voucher_status`;
              if (item.castType === "uuid") return Prisma.sql`${item.value}::uuid`;
            }
            if (typeof item === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item)) {
              return Prisma.sql`${item}::uuid`;
            }
            return Prisma.sql`${item}`;
          }),
          ", "
        )})
      `;

      if (regularFeeApplied && regularFeeAmount > 0 && tx.$executeRaw) {
        await tx.$executeRaw`
          INSERT INTO voucher_line_items (id, voucher_id, fee_type, title, amount, created_at)
          VALUES (${crypto.randomUUID()}::uuid, ${voucherId}::uuid, 'regular_fee', ${"Regular Fee"}, ${regularFeeAmount}, NOW())
        `;
      }

      if (admissionFeeAmount > 0) {
        await tx.$executeRaw`
          INSERT INTO voucher_line_items (id, voucher_id, fee_type, title, amount, created_at)
          VALUES (${crypto.randomUUID()}::uuid, ${voucherId}::uuid, ${selectedOtherFee?.fee_type || 'admission_fee'}, ${selectedOtherFee?.name || "Other Fee"}, ${admissionFeeAmount}, NOW())
        `;
      }

      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = CAST('voucher_created' AS registration_status)
        WHERE id = ${registrationLeadId}::uuid
      `;

      await insertAuditLog(
        session.user.id,
        voucherId,
        "fee_voucher_created",
        `Fee voucher ${voucherNo} created for registration lead ${registrationLeadId}.`,
        { voucherId, voucherNo, registrationLeadId },
        tx
      );

      const [created] = await tx.$queryRaw`
        SELECT
          fv.id::text AS id,
          fv.voucher_no,
          fv.amount,
          fv.regular_fee_applied,
          fv.regular_fee_amount,
          fv.admission_fee_amount,
          fv.discount_id::text AS discount_id,
          fv.discount_percent,
          fv.subtotal_amount,
          fv.discount_amount,
          fv.total_amount,
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
        WHERE fv.id = ${voucherId}::uuid
        LIMIT 1
      `;

      return { item: created, lead };
    });

    try {
      const portalBaseUrl = getAppUrl();
      if (item?.id && portalBaseUrl && lead?.email) {
        const html = buildFeeVoucherEmailHtml({
          studentName: lead.student_name || item.student_name || "",
          voucherNo: item.voucher_no || voucherNo,
          amount: item.amount || amount,
          dueDate: item.due_date || dueDate,
          portalUrl: `${portalBaseUrl.replace(/\/+$/, "")}/vouchers/${item.id}`,
        });

        await sendEmail({
          to: lead.email,
          subject: `Fee voucher ${item.voucher_no || voucherNo}`,
          html,
        });
      }
    } catch (emailError) {
      console.error("Fee voucher email dispatch failed:", emailError);
    }

    return json("Fee voucher created.", 201, { item });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create fee voucher.",
      500
    );
  }
}
