import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMeetAttendanceRecords, shareDriveFileWithUsers } from "@/lib/googleMeet";
import { extractMeetCodeFromLink } from "@/lib/googleCalendar";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin", "teacher"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function buildRecordingUrl(recording) {
  if (recording?.driveFileId) return `https://drive.google.com/file/d/${recording.driveFileId}/preview`;
  if (recording?.driveExportUri) return recording.driveExportUri;
  return "";
}

function extractDriveFileId(url) {
  const text = String(url || "").trim();
  const match = text.match(/\/file\/d\/([^/]+)/i);
  return match?.[1] || "";
}

export async function POST(_request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();
  const params = await context.params;
  const id = String(params?.id || "").trim();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);
  if (!id) return json("Public event id is required.", 400);

  try {
    const [event] = await prisma.$queryRaw`
      SELECT
        pe.id::text AS id,
        pe.title,
        pe.start_at,
        pe.end_at,
        pe.google_calendar_event_id,
        pe.meet_link,
        pe.recording_drive_url,
        creator.email AS created_by_email
      FROM public_events pe
      LEFT JOIN users creator ON creator.id = pe.created_by
      WHERE pe.id = ${id}::uuid
      LIMIT 1
    `;

    if (!event?.id) return json("Public event not found.", 404);

    if (event.recording_drive_url) {
      const existingFileId = extractDriveFileId(event.recording_drive_url);
      if (existingFileId) {
        await shareDriveFileWithUsers({
          fileId: existingFileId,
          emails: [],
          impersonateUserEmail: event.created_by_email || session.user.email || "",
        });
      }

      return json("Recording already available.", 200, {
        recording_drive_url: event.recording_drive_url,
      });
    }

    const meetSpaceId = extractMeetCodeFromLink(event.meet_link || "") || event.meet_link || "";
    if (!meetSpaceId) {
      return json("No Google Meet link is available for this public event yet.", 200, {
        recording_drive_url: "",
      });
    }

    const syncResult = await getMeetAttendanceRecords({
      meetSpaceId,
      scheduledStart: event.start_at,
      scheduledEnd: event.end_at,
      impersonateUserEmail: event.created_by_email || session.user.email || "",
      lectureIdentifiers: {
        storedMeetLink: event.meet_link || "",
        calendarEventId: event.google_calendar_event_id || "",
        organizerEmail: event.created_by_email || "",
      },
    });

    const recording = Array.isArray(syncResult.recordings) ? syncResult.recordings[0] : null;
    if (recording?.driveFileId) {
      await shareDriveFileWithUsers({
        fileId: recording.driveFileId,
        emails: [],
        impersonateUserEmail: event.created_by_email || session.user.email || "",
      });
    }

    const recordingUrl = buildRecordingUrl(recording);

    if (!recordingUrl) {
      await prisma.$executeRaw`
        UPDATE public_events
        SET recording_synced_at = NOW(),
            google_calendar_last_error = NULL,
            updated_at = NOW()
        WHERE id = ${event.id}::uuid
      `;

      return json("Recording is not available yet.", 200, {
        recording_drive_url: "",
      });
    }

    await prisma.$executeRaw`
      UPDATE public_events
      SET recording_drive_url = ${recordingUrl},
          recording_synced_at = NOW(),
          google_calendar_last_error = NULL,
          updated_at = NOW()
      WHERE id = ${event.id}::uuid
    `;

    return json("Recording synced successfully.", 200, {
      recording_drive_url: recordingUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync recording.";

    await prisma.$executeRaw`
      UPDATE public_events
      SET google_calendar_last_error = NULLIF(${message}, ''),
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json(message, 500);
  }
}
