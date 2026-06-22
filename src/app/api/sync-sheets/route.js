import { NextResponse } from "next/server";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const GVIZ_URL = SPREADSHEET_ID
  ? `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`
  : null;

const SHEET_HEADERS = [
  "google_sheet_row_id",
  "submitted_at",
  "student_name",
  "parent_name",
  "parent_relation",
  "email",
  "phone",
  "student_age",
  "class_level",
  "preferred_schedule",
  "address",
  "city",
  "notes",
  "source",
  "status",
  "synced_to_database",
  "database_registration_id",
  "last_synced_at",
  "sync_error",
];

function cleanValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeStatus(value) {
  return cleanValue(value).toLowerCase();
}

function parseGvizJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || start >= end) {
    throw new Error("Unable to parse Google Visualization response.");
  }

  const jsonText = text.slice(start, end + 1);
  return JSON.parse(jsonText);
}

function mapRow(row, rowIndex) {
  const cells = Array.isArray(row?.c) ? row.c : [];
  const lead = { rowNumber: rowIndex + 1 };

  SHEET_HEADERS.forEach((header, index) => {
    const cell = cells[index];
    const value = cell?.v ?? "";

    lead[header] = header === "status" ? normalizeStatus(value) : cleanValue(value);
  });

  return lead;
}

export async function GET() {
  try {
    if (!GVIZ_URL) {
      return NextResponse.json(
        { message: "GOOGLE_SHEETS_SPREADSHEET_ID environment variable is missing." },
        { status: 500 }
      );
    }

    const response = await fetch(GVIZ_URL, { cache: "no-store" });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { message: `Sheet fetch failed: ${response.status} ${response.statusText}`, detail: errorText },
        { status: response.status }
      );
    }

    const text = await response.text();
    const payload = parseGvizJson(text);
    const rows = payload?.table?.rows || [];

    const items = rows.map((row, index) => mapRow(row, index));

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unknown sync error." },
      { status: 500 }
    );
  }
}
