import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { normalizeClassLevel } from "@/lib/academicCatalog";

export function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSubmittedAt(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return new Set(rows.map((row) => row.column_name));
}

export function buildRegistrationLeadPayload(input = {}) {
  const submittedAt = normalizeSubmittedAt(input.submitted_at || input.submittedAt);
  const studentAge = normalizeText(input.student_age ?? input.studentAge);
  const email = normalizeText(input.email).toLowerCase();
  const phone = normalizeText(input.phone);
  const providedId =
    normalizeText(input.google_sheet_row_id) ||
    normalizeText(input.googleSheetRowId) ||
    normalizeText(input.submission_id) ||
    normalizeText(input.submissionId);

  return {
    googleSheetRowId:
      providedId || `${submittedAt?.toISOString() || new Date().toISOString()}-${email || phone}`,
    submittedAt,
    studentName: normalizeText(input.student_name ?? input.studentName),
    parentName: normalizeText(input.parent_name ?? input.parentName),
    parentRelation: normalizeText(input.parent_relation ?? input.parentRelation),
    email,
    phone,
    studentAge: studentAge ? Number(studentAge) : null,
    classLevel: normalizeClassLevel(input.class_level ?? input.classLevel),
    preferredSchedule: normalizeText(input.preferred_schedule ?? input.preferredSchedule),
    address: normalizeText(input.address),
    city: normalizeText(input.city),
    notes: normalizeText(input.notes),
    source: normalizeText(input.source) || "google_form",
  };
}

export function validateRegistrationLead(lead) {
  if (!lead.googleSheetRowId) {
    return "Missing submission id.";
  }

  if (!lead.studentName) {
    return "Missing student_name.";
  }

  if (!lead.email && !lead.phone) {
    return "Missing email or phone.";
  }

  if (!lead.classLevel) {
    return "Missing or invalid class_level.";
  }

  if (lead.studentAge !== null && Number.isNaN(lead.studentAge)) {
    return "Invalid student_age value.";
  }

  return "";
}

export async function upsertRegistrationLead(lead, tx = prisma) {
  const columns = await getTableColumns("registration_leads", tx);

  const [existing] = await tx.$queryRaw`
    SELECT
      rl.id::text AS id,
      rl.student_name,
      rl.email,
      rl.phone,
      EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = rl.id
      ) AS has_voucher
    FROM registration_leads rl
    WHERE rl.google_sheet_row_id = ${lead.googleSheetRowId}
    LIMIT 1
  `;

  const collidesWithVoucherLead =
    existing?.has_voucher &&
    (
      normalizeText(existing.student_name).toLowerCase() !== lead.studentName.toLowerCase() ||
      normalizeText(existing.email).toLowerCase() !== lead.email.toLowerCase() ||
      normalizeText(existing.phone) !== lead.phone
    );

  const googleSheetRowId = collidesWithVoucherLead
    ? `${lead.googleSheetRowId}-${Date.now()}`
    : lead.googleSheetRowId;

  const insertColumns = [Prisma.raw(`"google_sheet_row_id"`)];
  const insertValues = [Prisma.sql`${googleSheetRowId}`];
  const updateClauses = [];

  const pushOptional = (columnName, value) => {
    if (!columns.has(columnName)) {
      return;
    }

    insertColumns.push(Prisma.raw(`"${columnName}"`));
    insertValues.push(Prisma.sql`${value}`);
    updateClauses.push(Prisma.raw(`"${columnName}" = EXCLUDED."${columnName}"`));
  };

  pushOptional("created_at", lead.submittedAt);
  pushOptional("student_name", lead.studentName);
  pushOptional("parent_name", lead.parentName || null);
  pushOptional("parent_relation", lead.parentRelation || null);
  pushOptional("email", lead.email || null);
  pushOptional("phone", lead.phone || null);
  pushOptional("age", lead.studentAge);
  pushOptional("class_level", lead.classLevel || null);
  pushOptional("preferred_schedule", lead.preferredSchedule || null);
  pushOptional("address", lead.address || null);
  pushOptional("city", lead.city || null);
  pushOptional("notes", lead.notes || null);
  pushOptional("source", lead.source || null);

  if (columns.has("subject_interest")) {
    insertColumns.push(Prisma.raw(`"subject_interest"`));
    insertValues.push(Prisma.sql`NULL`);
    updateClauses.push(Prisma.sql`"subject_interest" = NULL`);
  }

  if (columns.has("status")) {
    insertColumns.push(Prisma.raw(`"status"`));
    insertValues.push(Prisma.sql`CAST('new_lead' AS registration_status)`);
    updateClauses.push(
      Prisma.sql`
        "status" = CASE
          WHEN registration_leads.status::text = 'voucher_created'
            AND NOT EXISTS (
              SELECT 1
              FROM fee_vouchers fv
              WHERE fv.registration_id = registration_leads.id
            )
            THEN CAST('new_lead' AS registration_status)
          ELSE registration_leads.status
        END
      `
    );
  }

  const [record] = await tx.$queryRaw(
    Prisma.sql`
      INSERT INTO registration_leads (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
      ON CONFLICT (google_sheet_row_id)
      DO UPDATE SET
        ${Prisma.join(updateClauses, ", ")}
      WHERE NOT EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = registration_leads.id
      )
      RETURNING id::text AS id, status::text AS status
    `
  );

  return record || existing;
}

export async function resetFalseVoucherCreatedLeads(tx = prisma) {
  await tx.$executeRaw`
    UPDATE registration_leads rl
    SET status = CAST('new_lead' AS registration_status)
    WHERE rl.status::text = 'voucher_created'
      AND NOT EXISTS (
        SELECT 1
        FROM fee_vouchers fv
        WHERE fv.registration_id = rl.id
      )
  `;
}
