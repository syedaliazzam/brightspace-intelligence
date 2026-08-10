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

export async function POST(request) {
  try {
    const body = await request.json();
    const eventId = cleanText(body?.eventId);
    const eventCategory = cleanText(body?.eventCategory);
    const email = cleanText(body?.email).toLowerCase();
    const whatsappCountryCode = cleanText(body?.whatsappCountryCode) || "+92";
    const whatsapp = cleanText(body?.whatsapp);
    const studentName = cleanText(body?.studentName);
    const studentNames = cleanList(body?.studentNames);
    const parentName = cleanText(body?.parentName);
    const schoolName = cleanText(body?.schoolName);
    const className = cleanText(body?.className);
    const notes = cleanText(body?.notes);
    const displayName = deriveDisplayName(eventCategory, studentName, parentName, studentNames);

    if (!eventId) return json("Event id is required.", 400);
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
        pe.event_category,
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

    const category = String(eventCategory || event.event_category || "").toLowerCase().trim();
    if ((category === "alh-students" || category === "general-students") && !studentName) {
      return json("Student name is required for this event category.", 400);
    }
    if (category === "general-students") {
      if (!schoolName) return json("School name is required for this event category.", 400);
      if (!className) return json("Class is required for this event category.", 400);
    }
    if (category === "alh-parents" || category === "general-parents") {
      if (!parentName) return json("Parent name is required for this event category.", 400);
      if (!studentNames.length) return json("At least one student name is required for this event category.", 400);
    }

    const [duplicate] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM public_event_registrations
      WHERE event_id = ${eventId}::uuid
        AND LOWER(COALESCE(status::text, 'pending')) <> 'cancelled'
        AND LOWER(COALESCE(email, '')) = ${email}
      LIMIT 1
    `;

    if (duplicate?.id) {
      return json("A registration already exists for this event with the same email address.", 400);
    }

    const [existingUser] = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM users
      WHERE LOWER(COALESCE(email, '')) = ${email}
      LIMIT 1
    `;

    const isFreeRegistration = Boolean(existingUser?.id);
    const registrationAmount = isFreeRegistration ? 0 : Number(event.event_fee_amount || 0);
    const registrationStatus = isFreeRegistration ? 'free' : 'pending';
    const studentNamesJson = studentNames.length ? JSON.stringify(studentNames) : null;

    const [created] = await prisma.$queryRaw`
      INSERT INTO public_event_registrations (
        id,
        event_id,
        participant_name,
        student_name,
        student_names,
        parent_name,
        school_name,
        class_input,
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
        ${displayName},
        ${studentName || null},
        ${studentNamesJson}::jsonb,
        ${parentName || null},
        ${schoolName || null},
        ${className || null},
        ${email},
        ${whatsappCountryCode && whatsapp ? `${whatsappCountryCode} ${whatsapp}` : whatsapp},
        ${notes || null},
        ${registrationAmount},
        ${registrationStatus},
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
            recipientName: displayName,
            registrationNo: created?.registration_no || "-",
            eventName: event.title || "Public Event",
            eventSchedule: `${formatEventDateTime(event.start_at)} - ${formatEventDateTime(event.end_at)}`,
            eventFee: isFreeRegistration ? "Free" : formatMoney(event.event_fee_amount || 0),
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
      success: true,
      registrationId: created?.id || "",
      registrationNo: created?.registration_no || "",
      registrationNumber: created?.registration_no || "",
      amountDue: registrationAmount,
      eventTitle: event.title || "",
      status: registrationStatus,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to submit public event registration.",
      500
    );
  }
}

