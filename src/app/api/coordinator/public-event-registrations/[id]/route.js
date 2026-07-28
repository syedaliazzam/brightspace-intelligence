import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildPublicEventVerificationEmailHtml, sendEmail } from "@/lib/email";
import { cleanText, formatEventDateTime, normalizeRegistrationStatus } from "@/lib/publicEvents";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function PATCH(request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const params = await context.params;
    const id = cleanText(params?.id);
    const body = await request.json();
    const nextStatus = normalizeRegistrationStatus(body?.status);

    if (!id) return json("Registration id is required.", 400);

    const [registration] = await prisma.$queryRaw`
      SELECT
        per.id::text AS id,
        per.registration_no,
        per.event_id::text AS event_id,
        per.participant_name,
        per.email,
        pe.title AS event_name,
        pe.start_at,
        pe.end_at,
        creator.full_name AS coordinator_name,
        creator.email AS coordinator_email,
        creator.phone AS coordinator_phone
      FROM public_event_registrations per
      INNER JOIN public_events pe ON pe.id = per.event_id
      LEFT JOIN users creator ON creator.id = pe.created_by
      WHERE per.id = ${id}::uuid
      LIMIT 1
    `;

    if (!registration?.id) return json("Registration record not found.", 404);

    await prisma.$executeRaw`
      UPDATE public_event_registrations
      SET
        status = ${nextStatus},
        verified_by = ${nextStatus === "verified" ? session.user.id : null}::uuid,
        verified_at = ${nextStatus === "verified" ? new Date() : null},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    if (nextStatus === "verified" && registration.email) {
      try {
        await sendEmail({
          to: registration.email,
          subject: "Public event registration verified",
          html: buildPublicEventVerificationEmailHtml({
            recipientName: registration.participant_name || "Participant",
            registrationNo: registration.registration_no || "-",
            eventName: registration.event_name || "Public Event",
            eventSchedule: `${formatEventDateTime(registration.start_at)} - ${formatEventDateTime(registration.end_at)}`,
            coordinatorName: registration.coordinator_name || "Coordinator",
            coordinatorEmail: registration.coordinator_email || "",
            coordinatorPhone: registration.coordinator_phone || "",
          }),
        });
      } catch (error) {
        console.warn("[public-event-registrations] Verification email failed", {
          email: registration.email,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json("Registration status updated.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update registration.", 500);
  }
}
