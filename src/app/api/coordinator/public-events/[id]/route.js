import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadAdmissionDocument } from "@/lib/supabaseStorage";
import { cleanText, parsePakistanDateTime } from "@/lib/publicEvents";
import { createCalendarPublicEvent, updateCalendarLectureEvent } from "@/lib/googleCalendar";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeCalendarSyncError(error) {
  const rawMessage = error instanceof Error ? error.message : String(error || "");
  const normalized = rawMessage.trim().toLowerCase();

  if (!normalized) {
    return "Google Meet could not be generated for this public event right now.";
  }

  if (normalized === "fetch failed") {
    return "Google Meet could not be generated right now because the Google Calendar service did not respond. Please check the Google service connection and try again.";
  }

  return rawMessage;
}

function toMoney(value) {
  const normalized = String(value || "").replace(/,/g, "").trim();
  if (!normalized) return 0;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : NaN;
}

async function getFirstCoordinatorEmail() {
  const [coordinator] = await prisma.$queryRaw`
    SELECT u.email
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) = 'coordinator'
      AND LOWER(u.status::text) = 'active'
      AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
    ORDER BY u.created_at ASC NULLS LAST, u.id ASC
    LIMIT 1
  `;

  return String(coordinator?.email || "").trim();
}

export async function PATCH(request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const params = await context.params;
    const id = cleanText(params?.id);

    if (!id) return json("Event id is required.", 400);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const eventCategory = cleanText(formData.get("eventCategory"));
      const title = cleanText(formData.get("title"));
      const description = cleanText(formData.get("description"));
      const startDate = cleanText(formData.get("startDate"));
      const endDate = cleanText(formData.get("endDate"));
      const startTime = cleanText(formData.get("startTime"));
      const endTime = cleanText(formData.get("endTime"));
      const eventFeeAmount = toMoney(formData.get("eventFeeAmount"));
      const registrationDeadlineDate = cleanText(formData.get("registrationDeadlineDate"));
      const registrationDeadlineTime = cleanText(formData.get("registrationDeadlineTime"));
      const file = formData.get("image");

      if (!eventCategory) return json("Event category is required.", 400);
      if (!title) return json("Event name is required.", 400);
      if (!description) return json("Event description is required.", 400);
      if (!startDate || !endDate || !startTime || !endTime) {
        return json("Event start and end date/time are required.", 400);
      }
      if (!Number.isFinite(eventFeeAmount) || eventFeeAmount < 0) {
        return json("A valid event fee is required.", 400);
      }

      const startAt = parsePakistanDateTime(startDate, startTime);
      const endAt = parsePakistanDateTime(endDate, endTime);
      if (!startAt || !endAt || endAt <= startAt) {
        return json("Event end time must be after the start time.", 400);
      }

      const registrationDeadline = registrationDeadlineDate && registrationDeadlineTime
        ? parsePakistanDateTime(registrationDeadlineDate, registrationDeadlineTime)
        : startAt;

      if (!registrationDeadline) {
        return json("A valid registration deadline is required.", 400);
      }

      const [event] = await prisma.$queryRaw`
        SELECT
          pe.id::text AS id,
          pe.meet_link,
          pe.google_calendar_event_id,
          pe.google_calendar_event_html_link
        FROM public_events pe
        WHERE pe.id = ${id}::uuid
        LIMIT 1
      `;

      if (!event?.id) return json("Event not found.", 404);

      let upload = null;
      if (file instanceof File && file.size > 0) {
        upload = await uploadAdmissionDocument({
          applicationId: id,
          documentType: "public_event_image",
          file,
        });
      }

      await prisma.$executeRaw`
        UPDATE public_events
        SET
          title = ${title},
          description = ${description},
          event_category = ${eventCategory},
          start_at = ${startAt},
          end_at = ${endAt},
          event_fee_amount = ${eventFeeAmount},
          registration_deadline = ${registrationDeadline},
          image_bucket = COALESCE(NULLIF(${upload?.bucket || ""}, ''), image_bucket),
          image_object_path = COALESCE(NULLIF(${upload?.objectPath || ""}, ''), image_object_path),
          image_stored_path = COALESCE(NULLIF(${upload?.storedPath || ""}, ''), image_stored_path),
          updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      if (event.google_calendar_event_id) {
        try {
          const organizerEmail = (await getFirstCoordinatorEmail()) || String(session.user.email || "").trim();
          const calendarData = await updateCalendarLectureEvent(event.google_calendar_event_id, {
            organizerEmail,
            title: title || "Public Event",
            description: description || "",
            start: startAt,
            end: endAt,
            attendees: [],
            timeZone: "Asia/Karachi",
          });

          await prisma.$executeRaw`
            UPDATE public_events
            SET
              meet_link = COALESCE(NULLIF(${calendarData?.meetLink || event.meet_link || ""}, ''), meet_link),
              google_calendar_event_html_link = COALESCE(NULLIF(${calendarData?.eventHtmlLink || event.google_calendar_event_html_link || ""}, ''), google_calendar_event_html_link),
              google_calendar_synced_at = NOW()::timestamptz,
              google_calendar_last_error = NULL,
              updated_at = NOW()
            WHERE id = ${id}::uuid
          `;
        } catch (error) {
          await prisma.$executeRaw`
            UPDATE public_events
            SET
              google_calendar_last_error = NULLIF(${normalizeCalendarSyncError(error)}, ''),
              updated_at = NOW()
            WHERE id = ${id}::uuid
          `;
        }
      }

      return json("Public event updated successfully.", 200);
    }

    const body = await request.json();
    const publicationStatus = cleanText(body?.publicationStatus).toLowerCase();

    if (!["draft", "published"].includes(publicationStatus)) {
      return json("A valid publication status is required.", 400);
    }

    const [event] = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.description,
        pe.start_at,
        pe.end_at,
        pe.meet_link,
        pe.google_calendar_event_id,
        pe.google_calendar_event_html_link,
        pe.google_calendar_synced_at,
        pe.google_calendar_last_error
      FROM public_events pe
      WHERE pe.id = ${id}::uuid
      LIMIT 1
    `;

    if (!event?.id) return json("Event not found.", 404);

    await prisma.$executeRaw`
      UPDATE public_events
      SET publication_status = ${publicationStatus},
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    if (publicationStatus === "published" && !event.google_calendar_event_id) {
      try {
        const organizerEmail = (await getFirstCoordinatorEmail()) || String(session.user.email || "").trim();
        const calendarData = await createCalendarPublicEvent({
          organizerEmail,
          title: event.title || "Public Event",
          description: event.description || "",
          start: event.start_at,
          end: event.end_at,
          attendees: [],
          timeZone: "Asia/Karachi",
        });

        await prisma.$executeRaw`
          UPDATE public_events
          SET
            meet_link = COALESCE(NULLIF(${event.meet_link || calendarData.meetLink || ""}, ''), meet_link),
            google_calendar_event_id = NULLIF(${calendarData.eventId || ""}, ''),
            google_calendar_event_html_link = NULLIF(${calendarData.eventHtmlLink || ""}, ''),
            google_calendar_synced_at = NOW()::timestamptz,
            google_calendar_last_error = NULL,
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `;
      } catch (error) {
        await prisma.$executeRaw`
          UPDATE public_events
          SET
            google_calendar_last_error = NULLIF(${normalizeCalendarSyncError(error)}, ''),
            updated_at = NOW()
          WHERE id = ${id}::uuid
        `;
      }
    }

    return json("Event publication status updated.", 200);
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to update event.", 500);
  }
}
