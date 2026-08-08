import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";
import { formatEventLifecycleStatus } from "@/lib/publicEvents";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.description,
        pe.meet_link,
        pe.recording_drive_url,
        pe.recording_synced_at,
        pe.google_calendar_last_error,
        pe.start_at,
        pe.end_at,
        pe.event_fee_amount::float8 AS event_fee_amount,
        pe.registration_deadline,
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
