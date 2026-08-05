import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl, uploadAdmissionDocument } from "@/lib/supabaseStorage";
import { cleanText, formatEventLifecycleStatus, parsePakistanDateTime } from "@/lib/publicEvents";
import { createCalendarPublicEvent } from "@/lib/googleCalendar";

const ALLOWED_VIEW_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher"]);
const ALLOWED_MANAGE_ROLES = new Set(["admin", "coordinator", "superadmin"]);

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

async function hydrateEventImages(items) {
  return Promise.all(
    (items || []).map(async (item) => ({
      ...item,
      image_url: item.image_stored_path
        ? await createSignedAdmissionDocumentUrl(item.image_stored_path).catch(() => "")
        : "",
      lifecycle_status: formatEventLifecycleStatus(item.start_at, item.end_at),
    }))
  );
}

async function syncPublicEventCalendar({ title, description, startAt, endAt, organizerEmail }) {
  try {
    const calendarData = await createCalendarPublicEvent({
      organizerEmail,
      title,
      description,
      start: startAt,
      end: endAt,
      attendees: [],
      timeZone: "Asia/Karachi",
    });

    return {
      calendarEventId: calendarData?.eventId || "",
      calendarEventHtmlLink: calendarData?.eventHtmlLink || "",
      calendarMeetLink: calendarData?.meetLink || "",
      syncedAt: new Date(),
      lastError: null,
    };
  } catch (error) {
    return {
      calendarEventId: "",
      calendarEventHtmlLink: "",
      calendarMeetLink: "",
      syncedAt: null,
      lastError: normalizeCalendarSyncError(error),
    };
  }
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_VIEW_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.description,
        pe.event_category,
        pe.meet_link,
        pe.start_at,
        pe.end_at,
        pe.event_fee_amount::float8 AS event_fee_amount,
        pe.registration_deadline,
        LOWER(pe.publication_status::text) AS publication_status,
        pe.image_stored_path,
        pe.image_bucket,
        pe.image_object_path,
        pe.google_calendar_event_id,
        pe.google_calendar_event_html_link,
        pe.google_calendar_synced_at,
        pe.google_calendar_last_error,
        pe.recording_drive_url,
        pe.recording_synced_at,
        pe.created_by::text AS created_by,
        creator.full_name AS created_by_name,
        creator.email AS created_by_email,
        creator.phone AS created_by_phone,
        pe.created_at,
        pe.updated_at,
        COALESCE(reg.count_total, 0)::int AS registration_count,
        COALESCE(reg.count_verified, 0)::int AS verified_count
      FROM public_events pe
      LEFT JOIN users creator ON creator.id = pe.created_by
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS count_total,
          COUNT(*) FILTER (WHERE LOWER(per.status::text) = 'verified') AS count_verified
        FROM public_event_registrations per
        WHERE per.event_id = pe.id
      ) reg ON TRUE
      ORDER BY pe.start_at DESC NULLS LAST, pe.created_at DESC NULLS LAST
    `;

    return json("Public events fetched.", 200, {
      items: await hydrateEventImages(items),
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch public events.", 500);
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_MANAGE_ROLES.has(role)) return json("Forbidden.", 403);

  try {
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
    if (!(file instanceof File) || file.size <= 0) return json("Event image is required.", 400);
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

    const eventId = crypto.randomUUID();
    const upload = await uploadAdmissionDocument({
      applicationId: eventId,
      documentType: "public_event_image",
      file,
    });

    const [created] = await prisma.$queryRaw`
      INSERT INTO public_events (
        id,
        title,
        description,
        event_category,
        meet_link,
        start_at,
        end_at,
        event_fee_amount,
        registration_deadline,
        publication_status,
        image_bucket,
        image_object_path,
        image_stored_path,
        created_by,
        google_calendar_event_id,
        google_calendar_event_html_link,
        google_calendar_synced_at,
        google_calendar_last_error,
        recording_drive_url,
        recording_synced_at,
        created_at,
        updated_at
      )
      VALUES (
        ${eventId}::uuid,
        ${title},
        ${description},
        ${eventCategory},
        NULL,
        ${startAt},
        ${endAt},
        ${eventFeeAmount},
        ${registrationDeadline},
        ${"published"},
        ${upload.bucket},
        ${upload.objectPath},
        ${upload.storedPath},
        ${session.user.id}::uuid,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

    const organizerEmail = (await getFirstCoordinatorEmail()) || String(session.user.email || "").trim();
    const syncResult = await syncPublicEventCalendar({
      title,
      description,
      startAt,
      endAt,
      organizerEmail,
    });

    if (syncResult.calendarEventId || syncResult.calendarEventHtmlLink || syncResult.syncedAt || syncResult.lastError) {
      const resolvedMeetLink = syncResult.calendarMeetLink || null;
      await prisma.$executeRaw`
        UPDATE public_events
        SET
          meet_link = COALESCE(NULLIF(${resolvedMeetLink || ""}, ''), meet_link),
          google_calendar_event_id = NULLIF(${syncResult.calendarEventId || ""}, ''),
          google_calendar_event_html_link = NULLIF(${syncResult.calendarEventHtmlLink || ""}, ''),
          google_calendar_synced_at = ${syncResult.syncedAt || null}::timestamptz,
          google_calendar_last_error = NULLIF(${syncResult.lastError || ""}, ''),
          updated_at = NOW()
        WHERE id = ${created?.id || eventId}::uuid
      `;
    }

    return json(
      syncResult.calendarEventId
        ? "Public event created successfully."
        : "Public event saved, but Google Meet could not be generated.",
      201,
      {
      id: created?.id || eventId,
      calendarSynced: Boolean(syncResult.calendarEventId),
      calendarEventId: syncResult.calendarEventId || "",
      meetLink: syncResult.calendarMeetLink || "",
      calendarError: syncResult.lastError || "",
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to create public event.", 500);
  }
}
