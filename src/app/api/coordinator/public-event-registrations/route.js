import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { formatRegistrationStatusLabel } from "@/lib/publicEvents";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        per.id::text AS id,
        per.registration_no,
        per.event_id::text AS event_id,
        pe.title AS event_name,
        pe.start_at AS event_start_at,
        pe.end_at AS event_end_at,
        per.participant_name,
        per.student_name,
        per.student_names,
        per.parent_name,
        per.school_name,
        per.class_input,
        per.email,
        per.whatsapp,
        per.notes,
        per.submitted_at,
        per.verified_at,
        per.verified_by::text AS verified_by,
        verifier.full_name AS verified_by_name,
        pe.created_by::text AS coordinator_id,
        creator.full_name AS coordinator_name,
        creator.email AS coordinator_email,
        creator.phone AS coordinator_phone,
        LOWER(COALESCE(pe.publication_status::text, 'draft')) AS event_publication_status,
        CASE
          WHEN existing_user.id IS NOT NULL AND LOWER(COALESCE(per.status::text, 'pending')) <> 'verified' THEN 'free'
          ELSE LOWER(COALESCE(per.status::text, 'pending'))
        END AS status,
        CASE
          WHEN existing_user.id IS NOT NULL AND LOWER(COALESCE(per.status::text, 'pending')) <> 'verified' THEN 0
          ELSE per.amount_due::float8
        END AS amount_due
      FROM public_event_registrations per
      INNER JOIN public_events pe ON pe.id = per.event_id
      LEFT JOIN users verifier ON verifier.id = per.verified_by
      LEFT JOIN users creator ON creator.id = pe.created_by
      LEFT JOIN users existing_user ON LOWER(COALESCE(existing_user.email, '')) = LOWER(COALESCE(per.email, ''))
      ORDER BY per.submitted_at DESC NULLS LAST, per.created_at DESC NULLS LAST
    `;

    const events = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.event_category,
        pe.start_at,
        pe.end_at,
        pe.event_fee_amount::float8 AS event_fee_amount,
        pe.registration_deadline,
        LOWER(COALESCE(pe.publication_status::text, 'draft')) AS publication_status
      FROM public_events pe
      ORDER BY pe.start_at DESC NULLS LAST, pe.created_at DESC NULLS LAST
    `;

    return json("Public event registrations fetched.", 200, {
      items: items.map((item) => ({
        ...item,
        status_label: formatRegistrationStatusLabel(item.status),
      })),
      events,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch event registrations.", 500);
  }
}

