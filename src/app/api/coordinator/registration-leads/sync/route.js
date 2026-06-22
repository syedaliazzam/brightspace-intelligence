import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { normalizeClassLevel } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";

// USE ENVIRONMENT VARIABLE FOR SPREADSHEET ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const PUBLIC_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSubmittedAt(value) {
  if (!value) {
    return null;
  }

  const parsedDate = parseGvizDateString(value);
  const date = parsedDate || new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function parseGvizDateString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+)(?:,(\d+))?)?\)$/);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] ?? 0);
  const minute = Number(match[5] ?? 0);
  const second = Number(match[6] ?? 0);

  return new Date(year, month, day, hour, minute, second);
}

function parseGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || start >= end) {
    throw new Error("Unable to parse Google Visualization response.");
  }

  return JSON.parse(text.slice(start, end + 1));
}

function mapGvizRowToLead(row, rowIndex) {
  const cells = Array.isArray(row?.c) ? row.c : [];
  const value = (index) => {
    const cell = cells[index];
    return cleanValue(cell?.v ?? "");
  };

  return {
    rowNumber: rowIndex + 1,
    google_sheet_row_id: value(0),
    submitted_at: value(1),
    student_name: value(2),
    parent_name: value(3),
    parent_relation: value(4),
    email: value(5).toLowerCase(),
    phone: value(6),
    student_age: value(7),
    class_level: value(8),
    subject_interest: "",
    preferred_schedule: value(9),
    address: value(10),
    city: value(11),
    notes: value(12),
    source: value(13),
    status: normalizeText(value(14)).toLowerCase(),
    synced_to_database: value(15),
    database_registration_id: value(16),
    last_synced_at: value(17),
    sync_error: value(18),
  };
}

function cleanValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeLead(row) {
  const submittedAt = normalizeText(row.submitted_at);
  const studentAge = normalizeText(row.student_age);
  const extraNotes = [];

  if (row.parent_relation) {
    extraNotes.push(`Parent relation: ${normalizeText(row.parent_relation)}`);
  }

  if (row.city) {
    extraNotes.push(`City: ${normalizeText(row.city)}`);
  }

  const notes = [normalizeText(row.notes), ...extraNotes].filter(Boolean).join("\n");

  return {
    rowNumber: row.rowNumber,
    googleSheetRowId: normalizeText(row.google_sheet_row_id),
    submittedAt: normalizeSubmittedAt(submittedAt),
    studentName: normalizeText(row.student_name),
    parentName: normalizeText(row.parent_name),
    parentRelation: normalizeText(row.parent_relation),
    email: normalizeText(row.email).toLowerCase(),
    phone: normalizeText(row.phone),
    studentAge: studentAge ? Number(studentAge) : null,
    classLevel: normalizeClassLevel(row.class_level),
    subjectInterest: "",
    preferredSchedule: normalizeText(row.preferred_schedule),
    address: normalizeText(row.address),
    city: normalizeText(row.city),
    notes,
    source: normalizeText(row.source) || "google_sheet",
    // Google Sheet status is not source of truth after sync.
    // New intake rows always enter PostgreSQL as new_lead.
    status: "new_lead",
  };
}

function validateLead(lead) {
  if (!lead.googleSheetRowId) {
    return "Missing google_sheet_row_id.";
  }

  if (!lead.studentName) {
    return "Missing student_name.";
  }

  if (!lead.email && !lead.phone) {
    return "Missing emai.";
  }

  if (!lead.classLevel) {
    return "Missing or invalid class_level. Allowed values: Pre-Nursery, Nursery, KG-1, KG-2.";
  }

  if (
    lead.submittedAt &&
    !(lead.submittedAt instanceof Date) &&
    Number.isNaN(Date.parse(lead.submittedAt))
  ) {
    return "Invalid submitted_at value.";
  }

  if (lead.studentAge !== null && Number.isNaN(lead.studentAge)) {
    return "Invalid student_age value.";
  }

  return "";
}

async function upsertLead(lead) {
  const [existing] = await prisma.$queryRaw`
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
    ? `${lead.googleSheetRowId}-row-${lead.rowNumber}`
    : lead.googleSheetRowId;

  const [record] = await prisma.$queryRaw`
    INSERT INTO registration_leads (
      google_sheet_row_id,
      created_at,
      student_name,
      parent_name,
      email,
      phone,
      age,
      class_level,
      subject_interest,
      preferred_schedule,
      address,
      notes,
      source,
      status
    )
    VALUES (
      ${googleSheetRowId},
      ${lead.submittedAt}::timestamp,
      ${lead.studentName},
      ${lead.parentName || null},
      ${lead.email || null},
      ${lead.phone || null},
      ${lead.studentAge},
      ${lead.classLevel},
      NULL,
      ${lead.preferredSchedule || null},
      ${lead.address || null},
      ${lead.notes || null},
      ${lead.source},
      CAST('new_lead' AS registration_status)
    )
    ON CONFLICT (google_sheet_row_id)
    DO UPDATE SET
      student_name = EXCLUDED.student_name,
      parent_name = EXCLUDED.parent_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      age = EXCLUDED.age,
      class_level = EXCLUDED.class_level,
      subject_interest = NULL,
      preferred_schedule = EXCLUDED.preferred_schedule,
      address = EXCLUDED.address,
      notes = EXCLUDED.notes,
      source = EXCLUDED.source,
      -- Google Sheet status is not source of truth after sync.
      -- Preserve database workflow status; voucher creation owns voucher_created.
      status = CASE
        WHEN registration_leads.status::text = 'voucher_created'
          AND NOT EXISTS (
            SELECT 1
            FROM fee_vouchers fv
            WHERE fv.registration_id = registration_leads.id
          )
          THEN CAST('new_lead' AS registration_status)
        ELSE registration_leads.status
      END
    WHERE NOT EXISTS (
      SELECT 1
      FROM fee_vouchers fv
      WHERE fv.registration_id = registration_leads.id
    )
    RETURNING id::text AS id, status::text AS status
  `;

  return record || existing;
}

async function resetFalseVoucherCreatedLeads() {
  await prisma.$executeRaw`
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

export async function POST() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return json("Unauthorized.", 401);
  }

  if (!ALLOWED_ROLES.has(role)) {
    return json("Forbidden.", 403);
  }

  if (!SPREADSHEET_ID) {
    return json("GOOGLE_SHEETS_SPREADSHEET_ID environment variable is missing.", 500);
  }

  try {
    const rows = await fetchPublicSheetRows();
    let createdOrUpdated = 0;
    let failed = 0;

    for (const row of rows) {
      const lead = normalizeLead(row);
      const validationError = validateLead(lead);

      if (validationError) {
        failed += 1;
        continue;
      }

      try {
        await upsertLead(lead);
        createdOrUpdated += 1;
      } catch (error) {
        failed += 1;
      }
    }

    await resetFalseVoucherCreatedLeads();

    return json("Google Sheet sync completed.", 200, {
      stats: {
        processed: rows.length,
        synced: createdOrUpdated,
        failed,
      },
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to sync Google Sheet records.",
      500
    );
  }
}

async function fetchPublicSheetRows() {
  const response = await fetch(PUBLIC_GVIZ_URL, { cache: "no-store" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Unable to fetch public sheet: ${response.status} ${response.statusText} ${errorText}`);
  }

  const text = await response.text();
  const payload = parseGvizJson(text);
  const rows = payload?.table?.rows || [];

  return rows.map((row, index) => mapGvizRowToLead(row, index));
}
