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
  if (columns.due_date) {
    addColumn(insertColumns, insertValues, "due_date", new Date(payload.dueDate));
    supportedColumns.add("due_date");
  }
  if (columns.payment_method) {
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

  if (status && VALID_VOUCHER_STATUSES.has(status)) {
    conditions.push(Prisma.sql`LOWER(fv.status::text) = ${status}`);
  }

  if (search) {
    const term = `%${search}%`;
    conditions.push(
      Prisma.sql`(
        fv.voucher_no ILIKE ${term}
        OR rl.student_name ILIKE ${term}
        OR rl.parent_name ILIKE ${term}
        OR rl.phone ILIKE ${term}
        OR rl.email ILIKE ${term}
      )`
    );
  }

  const whereClause = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
    : Prisma.empty;

  try {
    const items = await prisma.$queryRaw`
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
      ORDER BY fv.due_date ASC NULLS LAST, fv.id DESC
    `;

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
    const registrationLeadId = normalizeText(body?.registrationLeadId);
    const amount = Number(body?.amount);
    const dueDate = normalizeDueDate(body?.dueDate);
    const paymentMethod = normalizeText(body?.paymentMethod);
    const paymentInstructions = normalizeText(body?.paymentInstructions);

    if (!registrationLeadId) {
      return json("Registration lead is required.", 400);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return json("Amount must be greater than zero.", 400);
    }

    if (!dueDate) {
      return json("Valid due date is required.", 400);
    }

    if (!paymentMethod) {
      return json("Payment method is required.", 400);
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

      const resolvedPaymentMethod = await resolvePaymentMethod(paymentMethod, tx);

      if (!resolvedPaymentMethod) {
        throw new Error("Invalid payment method.");
      }

      const payload = {
        registrationLeadId,
        amount,
        dueDate,
        paymentMethod: resolvedPaymentMethod,
        paymentInstructions,
        createdByUserId: session.user.id,
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
