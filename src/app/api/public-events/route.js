import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";
import { formatEventLifecycleStatus } from "@/lib/publicEvents";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}


async function getTableColumns(tableName) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    `;
    return new Set(rows.map((row) => String(row.column_name || "").toLowerCase()));
  } catch {
    return new Set();
  }
}

let publicEventsColumnsEnsured = false;
async function ensurePublicEventsColumns() {
  if (publicEventsColumnsEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public_events ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) DEFAULT 'online';
      ALTER TABLE public_events ADD COLUMN IF NOT EXISTS location TEXT;
    `);
    publicEventsColumnsEnsured = true;
  } catch {
    // Graceful fallback if database permissions disallow DDL
  }
}

export async function GET() {
  try {
    await ensurePublicEventsColumns();
    const columns = await getTableColumns("public_events");
    const hasEventType = columns.has("event_type");
    const hasLocation = columns.has("location");
    const eventTypeExpr = hasEventType ? Prisma.sql`COALESCE(pe.event_type, 'online') AS event_type,` : Prisma.sql`'online' AS event_type,`;
    const locationExpr = hasLocation ? Prisma.sql`COALESCE(pe.location, '') AS location,` : Prisma.sql`'' AS location,`;

    const rows = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        ${eventTypeExpr}
        ${locationExpr}
        pe.title,
        pe.description,
        pe.meet_link,
        pe.recording_drive_url,
        pe.recording_synced_at,
        pe.google_calendar_last_error,
        pe.start_at,
        pe.end_at,
        pe.schedule_days,
        pe.event_fee_amount::float8 AS event_fee_amount,
        pe.registration_deadline,
        COALESCE(pe.registration_form_schema, '[]'::jsonb) AS registration_form_schema,
        LOWER(pe.publication_status::text) AS publication_status,
        pe.image_stored_path,
        pe.created_at,
        COALESCE(reg.count_total, 0)::int AS registration_count
      FROM public_events pe
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count_total
        FROM public_event_registrations per
        WHERE per.event_id = pe.id
      ) reg ON TRUE
      WHERE LOWER(pe.publication_status::text) = 'published'
      ORDER BY pe.start_at ASC NULLS LAST, pe.created_at DESC NULLS LAST
    `;

    const items = await Promise.all(
      rows.map(async (item) => ({
        ...item,
        image_url: item.image_stored_path
          ? await createSignedAdmissionDocumentUrl(item.image_stored_path).catch(() => "")
          : "",
        lifecycle_status: formatEventLifecycleStatus(item.start_at, item.end_at),
      }))
    );

    const currentUpcoming = items
      .filter((item) => item.lifecycle_status === "upcoming")
      .sort((left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime());

    const past = items
      .filter((item) => item.lifecycle_status === "past")
      .sort((left, right) => new Date(right.end_at).getTime() - new Date(left.end_at).getTime());

    return json("Public events fetched.", 200, {
      items,
      currentUpcoming,
      past,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch public events.", 500);
  }
}
