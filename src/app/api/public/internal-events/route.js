import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureInternalEventImageColumns() {
  await prisma.$executeRaw`
    ALTER TABLE internal_events
    ADD COLUMN IF NOT EXISTS image_bucket text,
    ADD COLUMN IF NOT EXISTS image_object_path text,
    ADD COLUMN IF NOT EXISTS image_stored_path text
  `;
}

export async function GET() {
  try {
    await ensureInternalEventImageColumns();

    const items = await prisma.$queryRaw`
      SELECT
        ie.id::text AS id,
        ie.title,
        ie.description,
        ie.scheduled_start,
        ie.scheduled_end,
        LOWER(ie.status::text) AS status,
        ie.google_meet_link,
        ie.calendar_html_link,
        ie.image_stored_path,
        host.full_name AS host_name,
        ie.created_at,
        ie.updated_at
      FROM internal_events ie
      LEFT JOIN users host ON host.id = ie.host_user_id
      WHERE LOWER(COALESCE(ie.status::text, 'scheduled')) <> 'cancelled'
      ORDER BY ie.scheduled_start ASC NULLS LAST, ie.created_at DESC NULLS LAST
    `;

    const safeItems = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        scheduled_start: item.scheduled_start,
        scheduled_end: item.scheduled_end,
        status: item.status,
        google_meet_link: item.google_meet_link,
        calendar_html_link: item.calendar_html_link,
        host_name: item.host_name,
        image_url: item.image_stored_path
          ? await createSignedAdmissionDocumentUrl(item.image_stored_path).catch(() => "")
          : "",
      }))
    );

    return json("Internal events fetched.", 200, { items: safeItems });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch internal events.", 500);
  }
}
