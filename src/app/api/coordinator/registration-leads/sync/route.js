import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  buildRegistrationLeadPayload,
  normalizeText,
  resetFalseVoucherCreatedLeads,
  upsertRegistrationLead,
  validateRegistrationLead,
} from "@/lib/registrationLeads";

// USE ENVIRONMENT VARIABLE FOR SPREADSHEET ID
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const PUBLIC_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
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
  return buildRegistrationLeadPayload({
    ...row,
    submitted_at: parseGvizDateString(normalizeText(row.submitted_at)) || row.submitted_at,
    source: normalizeText(row.source) || "google_form",
  });
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
      const validationError = validateRegistrationLead(lead);

      if (validationError) {
        failed += 1;
        continue;
      }

      try {
        await upsertRegistrationLead(lead, prisma);
        createdOrUpdated += 1;
      } catch (error) {
        failed += 1;
      }
    }

    await resetFalseVoucherCreatedLeads(prisma);

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
