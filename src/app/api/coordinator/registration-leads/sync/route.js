import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// USE ENVIRONMENT VARIABLE FOR SPREADSHEET ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const PUBLIC_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const LOCKED_STATUSES = [
  "voucher_created",
  "fee_submitted",
  "fee_verified",
  "access_granted",
];
const VALID_STATUSES = new Set([
  "new_lead",
  "voucher_created",
  "fee_submitted",
  "fee_verified",
  "access_granted",
  "rejected",
  "pending_clarification",
]);

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
    subject_interest: value(9),
    preferred_schedule: value(10),
    address: value(11),
    city: value(12),
    notes: value(13),
    source: value(14),
    status: normalizeText(value(15)).toLowerCase(),
    synced_to_database: value(16),
    database_registration_id: value(17),
    last_synced_at: value(18),
    sync_error: value(19),
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
  const incomingStatus = normalizeText(row.status).toLowerCase();
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
    classLevel: normalizeText(row.class_level),
    subjectInterest: normalizeText(row.subject_interest),
    preferredSchedule: normalizeText(row.preferred_schedule),
    address: normalizeText(row.address),
    city: normalizeText(row.city),
    notes,
    source: normalizeText(row.source) || "google_sheet",
    status: VALID_STATUSES.has(incomingStatus) ? incomingStatus : "new_lead",
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
    return "Missing email or phone.";
  }

  if (!lead.classLevel) {
    return "Missing class_level.";
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
      ${lead.googleSheetRowId},
      ${lead.submittedAt}::timestamp,
      ${lead.studentName},
      ${lead.parentName || null},
      ${lead.email || null},
      ${lead.phone || null},
      ${lead.studentAge},
      ${lead.classLevel},
      ${lead.subjectInterest || null},
      ${lead.preferredSchedule || null},
      ${lead.address || null},
      ${lead.notes || null},
      ${lead.source},
      CAST(${lead.status} AS registration_status)
    )
    ON CONFLICT (google_sheet_row_id)
    DO UPDATE SET
      student_name = EXCLUDED.student_name,
      parent_name = EXCLUDED.parent_name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      age = EXCLUDED.age,
      class_level = EXCLUDED.class_level,
      subject_interest = EXCLUDED.subject_interest,
      preferred_schedule = EXCLUDED.preferred_schedule,
      address = EXCLUDED.address,
      notes = EXCLUDED.notes,
      source = EXCLUDED.source,
      status = CASE
        WHEN registration_leads.status::text IN (${Prisma.join(LOCKED_STATUSES)})
          THEN registration_leads.status
        ELSE CAST(EXCLUDED.status AS registration_status)
      END
    RETURNING id::text AS id, status::text AS status
  `;

  return record;
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