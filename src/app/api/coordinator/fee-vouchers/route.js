import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
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

function normalizeClassLevel(value) {
  return String(value || "").trim().toLowerCase();
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

async function getRegularFeeById(regularFeeId, tx = prisma) {
  if (!regularFeeId) {
    return null;
  }

  const [row] = await tx.$queryRaw`
    SELECT
      id::text AS id,
      class_level,
      name,
      amount::text AS amount,
      status
    FROM regular_fee
    WHERE id = ${regularFeeId}::uuid
    LIMIT 1
  `;

  return row || null;
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

async function insertOutboundMessage({
  voucherId,
  recipientEmail,
  subject,
  body,
  bodyText,
  paymentSubmitUrl,
  createdBy,
  tx,
}) {
  const columns = await getTableColumns("outbound_messages", tx);
  if (!Object.keys(columns).length) {
    return null;
  }

  const insertColumns = [];
  const insertValues = [];
  const push = (name, value) => {
    if (!columns[name]) {
      return;
    }
    insertColumns.push(Prisma.raw(`"${name}"`));
    if (name === "id" || name.endsWith("_id") || name === "created_by") {
      insertValues.push({ value: value ?? null, castType: "uuid" });
      return;
    }
    insertValues.push(Prisma.sql`${value}`);
  };

  const messageId = crypto.randomUUID();
  push("id", messageId);
  push("message_type", "voucher_created");
  push("related_entity_type", "fee_voucher");
  push("related_entity_id", voucherId);
  push("recipient_email", recipientEmail);
  push("subject", subject);
  push("body", body);
  push("body_text", bodyText || "");
  push("payment_submit_url", paymentSubmitUrl || "");
  if (columns.created_by) {
    push("created_by", createdBy ?? null);
  }
  push("sent_status", "pending");
  push("created_at", new Date());
  push("updated_at", new Date());

  if (!insertColumns.length) {
    return null;
  }

  await tx.$executeRaw`
    INSERT INTO outbound_messages (${Prisma.join(insertColumns, ", ")})
    VALUES (${Prisma.join(
      insertValues.map((item) => {
        if (item && typeof item === "object" && item.castType === "uuid") {
          return Prisma.sql`${item.value ?? null}::uuid`;
        }
        return Prisma.sql`${item}`;
      }),
      ", "
    )})
  `;

  return {
    id: messageId,
    recipient_email: recipientEmail,
    subject,
    body,
    body_text: bodyText || "",
    payment_submit_url: paymentSubmitUrl || "",
    sent_status: "pending",
  };
}

function buildVoucherEmailContent({
  studentName,
  parentName,
  classLevel,
  voucherNo,
  regularFeeAmount,
  otherFeeAmount,
  discountPercent,
  discountAmount,
  totalAmount,
  dueDate,
  paymentMethod,
  paymentInstructions,
  supportEmail,
  supportPhone,
  paymentSubmitUrl,
  paymentMethodName,
}) {
  const details = [
    studentName ? `<tr><td>Student</td><td>${studentName}</td></tr>` : "",
    parentName ? `<tr><td>Parent</td><td>${parentName}</td></tr>` : "",
    classLevel ? `<tr><td>Class</td><td>${classLevel}</td></tr>` : "",
    `<tr><td>Voucher No</td><td>${voucherNo}</td></tr>`,
    regularFeeAmount > 0 ? `<tr><td>Regular Fee</td><td>${regularFeeAmount}</td></tr>` : "",
    otherFeeAmount > 0 ? `<tr><td>Other Fee</td><td>${otherFeeAmount}</td></tr>` : "",
    `<tr><td>Subtotal</td><td>${Number(regularFeeAmount + otherFeeAmount).toFixed(2)}</td></tr>`,
    `<tr><td>Discount on Regular Fee</td><td>${discountPercent}% (${discountAmount.toFixed(2)})</td></tr>`,
    `<tr><td>Total Payable</td><td>${totalAmount.toFixed(2)}</td></tr>`,
    dueDate ? `<tr><td>Due Date</td><td>${dueDate}</td></tr>` : "",
    paymentMethod?.name || paymentMethodName ? `<tr><td>Payment Method</td><td>${paymentMethod?.name || paymentMethodName}</td></tr>` : "",
    paymentMethod?.bank_name ? `<tr><td>Bank Name</td><td>${paymentMethod.bank_name}</td></tr>` : "",
    paymentMethod?.account_title ? `<tr><td>Account Title</td><td>${paymentMethod.account_title}</td></tr>` : "",
    paymentMethod?.account_number ? `<tr><td>Account Number</td><td>${paymentMethod.account_number}</td></tr>` : "",
    paymentMethod?.iban ? `<tr><td>IBAN</td><td>${paymentMethod.iban}</td></tr>` : "",
    paymentMethod?.branch_code ? `<tr><td>Branch Code</td><td>${paymentMethod.branch_code}</td></tr>` : "",
    paymentInstructions ? `<tr><td>Instructions</td><td>${paymentInstructions}</td></tr>` : "",
    supportEmail ? `<tr><td>Support Email</td><td>${supportEmail}</td></tr>` : "",
    supportPhone ? `<tr><td>Support Phone</td><td>${supportPhone}</td></tr>` : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
        <h2 style="margin:0 0 16px;">Fee Voucher Created</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${details}
        </table>
        <div style="margin-top:20px;">
          <a href="${paymentSubmitUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">Submit Payment</a>
          <p style="margin:12px 0 0;font-size:12px;color:#64748b;">If the button does not work, open this link:</p>
          <p style="margin:4px 0 0;font-size:12px;color:#2563eb;word-break:break-all;">${paymentSubmitUrl}</p>
        </div>
      </div>
    </div>
  `;

  const text = `
Fee Voucher Created

Student: ${studentName || "-"}
Parent: ${parentName || "-"}
Class: ${classLevel || "-"}
Voucher No: ${voucherNo}

Regular Fee: ${regularFeeAmount > 0 ? regularFeeAmount.toFixed(2) : "0.00"}
Other Fee: ${otherFeeAmount > 0 ? otherFeeAmount.toFixed(2) : "0.00"}
Subtotal: ${Number(regularFeeAmount + otherFeeAmount).toFixed(2)}
Discount on Regular Fee: ${discountPercent}% (${discountAmount.toFixed(2)})
Total Payable: ${totalAmount.toFixed(2)}
Due Date: ${dueDate || "-"}

Payment Method: ${paymentMethod?.name || "-"}
Account Title: ${paymentMethod?.account_title || "-"}
Account Number: ${paymentMethod?.account_number || "-"}
IBAN: ${paymentMethod?.iban || "-"}
Branch Code: ${paymentMethod?.branch_code || "-"}
Instructions: ${paymentInstructions || paymentMethod?.instructions || "-"}

Submit Payment:
${paymentSubmitUrl}

Support Email: ${supportEmail || "-"}
Support Phone: ${supportPhone || "-"}
`.trim();

  return { html, text };
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

function buildPaymentSubmitUrl(voucherNo) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";
  const base = appUrl || "";
  return `${base.replace(/\/+$/, "")}/payment/${encodeURIComponent(voucherNo)}`;
}

async function buildVoucherInsertPayload(voucherNo, payload, tx) {
  const columns = await getTableColumns("fee_vouchers", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const voucherId = crypto.randomUUID();

  if (columns.id) {
    insertColumns.push(Prisma.raw(`"id"`));
    insertValues.push({ value: voucherId, castType: "uuid" });
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
    insertValues.push({ value: payload.discountId || null, castType: "uuid" });
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
    insertColumns.push(Prisma.raw(`"created_by_user_id"`));
    insertValues.push({ value: payload.createdByUserId, castType: "uuid" });
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
        pm.bank_name,
        fv.payment_instructions,
        LOWER(rl.status::text) AS lead_status,
        LOWER(fv.status::text) AS voucher_status,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.email,
        rl.phone
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
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
    const regularFeeId = normalizeText(body?.regular_fee_id ?? body?.regularFeeId);
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
        pm.bank_name,
        fv.payment_instructions,
        LOWER(rl.status::text) AS lead_status,
        LOWER(fv.status::text) AS voucher_status,
        LOWER(fv.status::text) AS status,
        rl.id::text AS registration_lead_id,
        rl.student_name,
        rl.parent_name,
        rl.email,
        rl.phone
      FROM fee_vouchers fv
      INNER JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
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

    const { item, lead, emailMessage } = await prisma.$transaction(async (tx) => {
      const createdBy = session?.user?.id || null;
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

      let regularFeeRecord = null;
      if (regularFeeApplied) {
        if (!regularFeeId) {
          throw new Error("Regular fee ID is missing.");
        }

        regularFeeRecord = await getRegularFeeById(regularFeeId, tx);
        if (!regularFeeRecord?.id) {
          console.log("REGULAR_FEE_VALIDATE_DEBUG", {
            leadId: registrationLeadId,
            leadClassLevel: lead?.class_level,
            regularFeeId,
            regularFeeClassLevel: regularFeeRecord?.class_level,
            regularFeeStatus: regularFeeRecord?.status,
            normalizedLeadClass: normalizeClassLevel(lead?.class_level),
            normalizedFeeClass: normalizeClassLevel(regularFeeRecord?.class_level),
          });
          throw new Error("Regular fee record was not found.");
        }

        if (String(regularFeeRecord.status || "").toLowerCase() !== "active") {
          throw new Error("Regular fee is inactive.");
        }

        if (
          normalizeClassLevel(regularFeeRecord.class_level) !==
          normalizeClassLevel(lead.class_level)
        ) {
          console.log("REGULAR_FEE_VALIDATE_DEBUG", {
            leadId: registrationLeadId,
            leadClassLevel: lead?.class_level,
            regularFeeId,
            regularFeeClassLevel: regularFeeRecord?.class_level,
            regularFeeStatus: regularFeeRecord?.status,
            normalizedLeadClass: normalizeClassLevel(lead?.class_level),
            normalizedFeeClass: normalizeClassLevel(regularFeeRecord?.class_level),
          });
          throw new Error("Regular fee does not match the selected lead class.");
        }
      }

      const maxDiscountPercent =
        role === "admin" ? 100 : await getCoordinatorMaxDiscountPercent(tx);
      const discount = await getDiscountById(discountId, tx);
      const regularFeeAmount = regularFeeApplied
        ? Number(regularFeeRecord?.amount || 0)
        : 0;
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
      const discountAmount = Number((regularFeeAmount * discountPercent / 100).toFixed(2));
      const totalAmount = Number((subtotalAmount - discountAmount).toFixed(2));
      if (totalAmount <= 0) {
        throw new Error("Voucher total must be greater than zero.");
      }
      const voucherAmount = totalAmount;

      const paymentSubmitUrl = buildPaymentSubmitUrl(voucherNo);
      const payload = {
        registrationLeadId,
        amount: voucherAmount,
        dueDate,
        paymentMethodId: selectedPaymentMethod?.id || null,
        paymentMethod: resolvedPaymentMethod,
        paymentInstructions,
        createdByUserId: session.user.id,
        regularFeeApplied,
        regularFeeId: regularFeeRecord?.id || null,
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
          INSERT INTO voucher_line_items (id, voucher_id, fee_type, title, amount, source_fee_id, created_at)
          VALUES (${crypto.randomUUID()}::uuid, ${voucherId}::uuid, 'regular_fee', ${regularFeeRecord?.name || `Regular Fee - ${regularFeeRecord?.class_level || ""}`}, ${regularFeeAmount}, ${regularFeeRecord?.id || null}::uuid, NOW())
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
          pm.bank_name,
          fv.payment_instructions,
          LOWER(rl.status::text) AS lead_status,
          LOWER(fv.status::text) AS voucher_status,
          LOWER(fv.status::text) AS status,
          rl.id::text AS registration_lead_id,
          rl.student_name,
          rl.parent_name,
          rl.email,
          rl.phone
        FROM fee_vouchers fv
        INNER JOIN registration_leads rl ON rl.id = fv.registration_id
        LEFT JOIN payment_methods pm ON pm.id = fv.payment_method_id
        WHERE fv.id = ${voucherId}::uuid
        LIMIT 1
      `;

      const supportEmail =
        (await tx.$queryRaw`
          SELECT value::text AS value
          FROM fee_settings
          WHERE key = 'payment_support_email'
          LIMIT 1
        `)[0]?.value || "";
      const supportPhone =
        (await tx.$queryRaw`
          SELECT value::text AS value
          FROM fee_settings
          WHERE key = 'payment_support_phone'
          LIMIT 1
        `)[0]?.value || "";

      const { html: emailHtml, text: emailText } = buildVoucherEmailContent({
        studentName: lead.student_name || "",
        parentName: lead.parent_name || "",
        classLevel: lead.class_level || "",
        voucherNo: created.voucher_no || voucherNo,
        regularFeeAmount,
        otherFeeAmount: admissionFeeAmount,
        discountPercent,
        discountAmount,
        totalAmount,
        dueDate,
        paymentMethod: selectedPaymentMethod || { name: resolvedPaymentMethod },
        paymentInstructions,
        supportEmail,
        supportPhone,
        paymentSubmitUrl,
        paymentMethodName: resolvedPaymentMethod,
      });

      const subject = `Fee voucher ${created.voucher_no || voucherNo}`;
      const emailMessage = await insertOutboundMessage({
        voucherId,
        recipientEmail: lead.email,
        subject,
        body: emailHtml,
        bodyText: emailText,
        paymentSubmitUrl,
        createdBy,
        tx,
      });

      return {
        item: created,
        lead,
        emailMessage: emailMessage ? { ...emailMessage, sent_status: "pending" } : null,
      };
    }, { timeout: 15000 });

    let emailSendStatus = "sent";
    let emailErrorMessage = "";

    try {
      if (item?.id && lead?.email) {
        await sendEmail({
          to: lead.email,
          subject: emailMessage?.subject || `Fee voucher ${item.voucher_no || voucherNo}`,
          html: emailMessage?.body || "",
          text: emailMessage?.body_text || "",
        });
      }
    } catch (emailError) {
      emailSendStatus = "failed";
      emailErrorMessage =
        emailError instanceof Error ? emailError.message : "Voucher email dispatch failed.";
      console.error("SENDGRID_VOUCHER_EMAIL_ERROR", {
        message: emailError?.message,
        response: emailError?.response?.body,
      });
      if (emailMessage?.id) {
        await prisma.$executeRaw`
          UPDATE outbound_messages
          SET sent_status = 'failed',
              updated_at = NOW()
          WHERE id = ${emailMessage.id}::uuid
        `;
      }
    }

    if (emailSendStatus === "sent" && emailMessage?.id) {
      await prisma.$executeRaw`
        UPDATE outbound_messages
        SET sent_status = 'sent',
            sent_at = NOW(),
            updated_at = NOW()
        WHERE id = ${emailMessage.id}::uuid
      `;
    }

    return json(
      emailSendStatus === "sent"
        ? "Voucher created and email sent successfully."
        : "Voucher created successfully, but email sending failed.",
      201,
      {
        success: true,
        email_sent: emailSendStatus === "sent",
        voucher: item,
        email: emailMessage
          ? {
              ...emailMessage,
              body_html: emailMessage.body,
              body_text: emailMessage.body_text,
              payment_submit_url: emailMessage.payment_submit_url,
              sent_status: emailSendStatus,
            }
          : null,
        ...(emailSendStatus === "sent"
          ? {}
          : { sendgrid_error: emailErrorMessage || "SendGrid email failed." }),
      }
    );
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to create fee voucher.",
      500
    );
  }
}
