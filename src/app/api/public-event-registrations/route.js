import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildPublicEventRegistrationEmailHtml, sendEmail } from "@/lib/email";
import { cleanText, formatEventDateTime, formatMoney } from "@/lib/publicEvents";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = cleanText(body?.eventId);
    const participantName = cleanText(body?.participantName);
    const email = cleanText(body?.email).toLowerCase();
    const whatsapp = cleanText(body?.whatsapp);
    const notes = cleanText(body?.notes);

    if (!eventId) return json("Event id is required.", 400);
    if (!participantName) return json("Participant name is required.", 400);
    if (!email || !email.includes("@")) return json("A valid email is required.", 400);
    if (!whatsapp) return json("WhatsApp number is required.", 400);

    const [event] = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.description,
        pe.start_at,
        pe.end_at,
        pe.event_fee_amount::float8 AS event_fee_amount,
        pe.registration_deadline,
        LOWER(pe.publication_status::text) AS publication_status,
        pe.created_by::text AS created_by,
        creator.full_name AS coordinator_name,
        creator.email AS coordinator_email,
        creator.phone AS coordinator_phone
      FROM public_events pe
      LEFT JOIN users creator ON creator.id = pe.created_by
      WHERE pe.id = ${eventId}::uuid
      LIMIT 1
    `;

    if (!event?.id) return json("Public event not found.", 404);
    if (String(event.publication_status || "").toLowerCase() !== "published") {
      return json("This event is not open for public registration.", 400);
    }

    const now = new Date();
    const eventEnd = event.end_at ? new Date(event.end_at) : null;
    const registrationDeadline = event.registration_deadline ? new Date(event.registration_deadline) : null;

    if (registrationDeadline && !Number.isNaN(registrationDeadline.getTime()) && now > registrationDeadline) {
      return json("Registration deadline has passed for this event.", 400);
    }
    if (eventEnd && !Number.isNaN(eventEnd.getTime()) && now > eventEnd) {
      return json("This event has already ended, and registration is now closed.", 400);
    }

    const [duplicate] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM public_event_registrations
      WHERE event_id = ${eventId}::uuid
        AND LOWER(COALESCE(status::text, 'pending')) <> 'cancelled'
        AND (
          LOWER(COALESCE(email, '')) = ${email}
          OR REGEXP_REPLACE(COALESCE(whatsapp, ''), '\D', '', 'g') = ${normalizePhone(whatsapp)}
        )
      LIMIT 1
    `;

    if (duplicate?.id) {
      return json("A registration already exists for this event with the same email or WhatsApp number.", 400);
    }

    const [created] = await prisma.$queryRaw`
      INSERT INTO public_event_registrations (
        id,
        event_id,
        participant_name,
        email,
        whatsapp,
        notes,
        amount_due,
        status,
        submitted_at,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${eventId}::uuid,
        ${participantName},
        ${email},
        ${whatsapp},
        ${notes || null},
        ${Number(event.event_fee_amount || 0)},
        'pending',
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING id::text AS id, registration_no
    `;

    const paymentMethods = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        name,
        bank_name,
        account_title,
        account_number,
        iban,
        branch_code,
        instructions
      FROM payment_methods
      WHERE LOWER(status::text) = 'active'
      ORDER BY name ASC
    `;

    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: "Public event registration received",
          html: buildPublicEventRegistrationEmailHtml({
            recipientName: participantName,
            registrationNo: created?.registration_no || "-",
            eventName: event.title || "Public Event",
            eventSchedule: `${formatEventDateTime(event.start_at)} - ${formatEventDateTime(event.end_at)}`,
            eventFee: formatMoney(event.event_fee_amount || 0),
            coordinatorName: event.coordinator_name || "Coordinator",
            coordinatorEmail: event.coordinator_email || "",
            coordinatorPhone: event.coordinator_phone || "",
            paymentMethods,
          }),
        });
      } catch (error) {
        console.warn("[public-event-registrations] Confirmation email failed", {
          email,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json("Public event registration submitted successfully.", 201, {
      registrationId: created?.id || "",
      registrationNo: created?.registration_no || "",
      status: "pending",
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to submit public event registration.",
      500
    );
  }
}
