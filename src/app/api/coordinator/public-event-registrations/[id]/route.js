import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { buildPublicEventVerificationEmailHtml, sendEmail } from "@/lib/email";
import { cleanText, formatEventDateTime, normalizeRegistrationStatus } from "@/lib/publicEvents";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function cleanList(values) {
  return Array.isArray(values)
    ? values.map((item) => cleanText(item)).filter(Boolean)
    : [];
}

function deriveDisplayName(category, studentName, parentName, studentNames) {
  const key = String(category || "").toLowerCase().trim();
  if (key === "alh-students" || key === "general-students") {
    return studentName || "Student";
  }
  if (key === "alh-parents" || key === "general-parents") {
    return parentName || studentNames?.[0] || "Parent";
  }
  return studentName || parentName || "Participant";
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
    const hasDetailUpdate = body?.editRegistration === true;
    const nextStatusRaw = cleanText(body?.status);
    const hasStatusUpdate = Boolean(nextStatusRaw);
    const nextStatus = hasStatusUpdate ? normalizeRegistrationStatus(nextStatusRaw) : null;
    const hasAmountUpdate = body?.amountDue !== undefined || body?.amount_due !== undefined;
    const nextAmount = hasAmountUpdate ? Number(body?.amountDue ?? body?.amount_due ?? 0) : null;

    if (!id) return json("Registration id is required.", 400);

    if (hasDetailUpdate) {
      const eventId = cleanText(body?.eventId);
      const email = cleanText(body?.email).toLowerCase();
      const whatsapp = cleanText(body?.whatsapp);
      const studentName = cleanText(body?.studentName);
      const studentNames = cleanList(body?.studentNames);
      const parentName = cleanText(body?.parentName);
      const schoolName = cleanText(body?.schoolName);
      const className = cleanText(body?.className);
      const notes = cleanText(body?.notes);
      const amountDue = Number(body?.amountDue ?? 0);
      const statusToSave = normalizeRegistrationStatus(cleanText(body?.status) || "pending");

      if (!eventId) return json("Event is required.", 400);
      if (!email || !email.includes("@")) return json("A valid email is required.", 400);
      if (!whatsapp) return json("WhatsApp number is required.", 400);
      if (!Number.isFinite(amountDue) || amountDue < 0) return json("A valid amount is required.", 400);

      const [event] = await prisma.$queryRaw`
        SELECT
          pe.id::text AS id,
          pe.event_category,
          pe.title AS event_name,
          pe.start_at,
          pe.end_at,
          creator.full_name AS coordinator_name,
          creator.email AS coordinator_email,
          creator.phone AS coordinator_phone
        FROM public_events pe
        LEFT JOIN users creator ON creator.id = pe.created_by
        WHERE pe.id = ${eventId}::uuid
        LIMIT 1
      `;

      if (!event?.id) return json("Public event not found.", 404);

      const [currentRegistration] = await prisma.$queryRaw`
        SELECT per.registration_no
        FROM public_event_registrations per
        WHERE per.id = ${id}::uuid
        LIMIT 1
      `;

      if (!currentRegistration?.registration_no) return json("Registration record not found.", 404);

      const [duplicate] = await prisma.$queryRaw`
        SELECT per.id::text AS id
        FROM public_event_registrations per
        WHERE per.event_id = ${eventId}::uuid
          AND per.id <> ${id}::uuid
          AND LOWER(COALESCE(per.status::text, 'pending')) <> 'cancelled'
          AND LOWER(COALESCE(per.email, '')) = ${email}
        LIMIT 1
      `;

      if (duplicate?.id) {
        return json("Another registration already exists for this event with the same email address.", 400);
      }

      const displayName = deriveDisplayName(event.event_category, studentName, parentName, studentNames);
      const studentNamesJson = studentNames.length ? JSON.stringify(studentNames) : null;
      const verifiedAt = statusToSave === "verified" ? new Date() : null;

      await prisma.$executeRaw`
        UPDATE public_event_registrations
        SET
          event_id = ${eventId}::uuid,
          participant_name = ${displayName},
          student_name = ${studentName || null},
          student_names = ${studentNamesJson}::jsonb,
          parent_name = ${parentName || null},
          school_name = ${schoolName || null},
          class_input = ${className || null},
          email = ${email},
          whatsapp = ${whatsapp},
          notes = ${notes || null},
          amount_due = ${amountDue},
          status = ${statusToSave},
          verified_by = ${statusToSave === "verified" ? session.user.id : null}::uuid,
          verified_at = ${verifiedAt},
          updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      if (statusToSave === "verified" && email) {
        try {
          await sendEmail({
            to: email,
            subject: "Public event registration verified",
            html: buildPublicEventVerificationEmailHtml({
              recipientName: displayName || "Participant",
              registrationNo: currentRegistration.registration_no || "-",
              eventName: event.event_name || "Public Event",
              eventSchedule: `${formatEventDateTime(event.start_at)} - ${formatEventDateTime(event.end_at)}`,
              coordinatorName: event.coordinator_name || "Coordinator",
              coordinatorEmail: event.coordinator_email || "",
              coordinatorPhone: event.coordinator_phone || "",
            }),
          });
        } catch (error) {
          console.warn("[public-event-registrations] Verification email failed", {
            email,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return json("Registration record updated.", 200);
    }

    const [registration] = await prisma.$queryRaw`
      SELECT
        per.id::text AS id,
        per.registration_no,
        per.event_id::text AS event_id,
        per.participant_name,
        per.email,
        per.amount_due::float8 AS amount_due,
        per.status::text AS status,
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

    const statusToSave = hasStatusUpdate ? nextStatus : String(registration.status || "pending").toLowerCase();
    const amountToSave = hasAmountUpdate ? nextAmount : Number(registration.amount_due || 0);

    await prisma.$executeRaw`
      UPDATE public_event_registrations
      SET
        status = ${statusToSave},
        amount_due = ${amountToSave},
        verified_by = ${statusToSave === "verified" ? session.user.id : null}::uuid,
        verified_at = ${statusToSave === "verified" ? new Date() : null},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    if (statusToSave === "verified" && registration.email) {
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

