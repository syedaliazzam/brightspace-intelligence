import crypto from "crypto";
import { NextResponse } from "next/server";
import { getMeetAttendanceRecords } from "@/lib/googleMeet";
import { extractMeetCodeFromLink } from "@/lib/googleCalendar";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];
const PRESENT_THRESHOLD_MINUTES = Number(process.env.LECTURE_PRESENT_THRESHOLD_MINUTES || 20);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureAttendanceColumns() {
  await prisma.$executeRaw`
    ALTER TABLE lecture_attendance
    ADD COLUMN IF NOT EXISTS participant_email TEXT,
    ADD COLUMN IF NOT EXISTS participant_name TEXT,
    ADD COLUMN IF NOT EXISTS google_participant_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS google_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS meet_raw JSONB
  `;

  await prisma.$executeRaw`
    ALTER TABLE lecture_schedules
    ADD COLUMN IF NOT EXISTS google_meet_sync_meta JSONB
  `;
}

function attendanceStatus(duration) {
  return duration >= PRESENT_THRESHOLD_MINUTES ? "present" : "partial";
}

export async function POST(_request, { params }) {
  try {
    await requireRole(ALLOWED_ROLES);
    await ensureAttendanceColumns();

    const { id } = await params;
    const [lecture] = await prisma.$queryRaw`
      SELECT
        ls.id::text AS id,
        ls.google_meet_link,
        ls.google_meet_space_id,
        ls.google_calendar_event_id,
        ls.recording_drive_url,
        ls.scheduled_start,
        ls.scheduled_end,
        ls.scheduled_by::text AS coordinator_user_id,
        cu.email AS coordinator_email,
        cu.full_name AS coordinator_name,
        tu.id::text AS teacher_user_id,
        tu.email AS teacher_email,
        tu.full_name AS teacher_name,
        su.id::text AS student_user_id,
        su.email AS student_email,
        su.full_name AS student_name,
        pu.id::text AS parent_user_id,
        pu.email AS parent_email,
        pu.full_name AS parent_name
      FROM lecture_schedules ls
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN users cu ON cu.id = ls.scheduled_by
      INNER JOIN student_profiles sp ON sp.id = ls.student_id
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE ls.id = ${id}::uuid
      LIMIT 1
    `;

    if (!lecture?.id) {
      return json("Lecture schedule not found.", 404);
    }

    const meetSpaceId =
      lecture.google_meet_space_id || extractMeetCodeFromLink(lecture.google_meet_link);
    const meetData = await getMeetAttendanceRecords({
      meetSpaceId,
      scheduledStart: lecture.scheduled_start,
      scheduledEnd: lecture.scheduled_end,
      impersonateUserEmail: lecture.coordinator_email || lecture.teacher_email || "",
    });

    if (!meetData.available) {
      const pendingMessage = lecture.recording_drive_url
        ? "Recording is available, but Google Meet attendance is still being processed. Please try syncing again shortly."
        : "Meet attendance may be available only after Google finishes processing the conference record.";
      return json(pendingMessage, 200, {
        synced: 0,
        unmatched_participants: [],
        available: false,
      });
    }

    const participantsByEmail = new Map();
    const participantsByName = new Map();
    const addExpectedParticipant = ({ email, name, attendanceUserId, roleType }) => {
      const participant = { attendanceUserId, roleType };
      if (email) participantsByEmail.set(String(email).toLowerCase(), participant);
      if (name) participantsByName.set(String(name).trim().toLowerCase(), participant);
    };

    addExpectedParticipant({
      email: lecture.coordinator_email,
      name: lecture.coordinator_name,
      attendanceUserId: lecture.coordinator_user_id,
      roleType: "coordinator",
    });
    addExpectedParticipant({
      email: lecture.teacher_email,
      name: lecture.teacher_name,
      attendanceUserId: lecture.teacher_user_id,
      roleType: "teacher",
    });
    const unmatched = [];
    let synced = 0;

    for (const record of meetData.records) {
      const email = String(record.participantEmail || "").toLowerCase();
      const name = String(record.participantName || "").trim().toLowerCase();
      const participant = participantsByEmail.get(email) || participantsByName.get(name);

      if (!participant?.attendanceUserId) {
        unmatched.push(record);
        continue;
      }

      await prisma.$executeRaw`
        INSERT INTO lecture_attendance (
          id,
          lecture_id,
          user_id,
          role_type,
          joined_at,
          left_at,
          duration_minutes,
          source,
          status,
          participant_email,
          participant_name,
          google_participant_id,
          google_session_id,
          meet_raw
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${id}::uuid,
          ${participant.attendanceUserId}::uuid,
          ${participant.roleType},
          ${record.joinedAt ? new Date(record.joinedAt) : null}::timestamp,
          ${record.leftAt ? new Date(record.leftAt) : null}::timestamp,
          ${record.durationMinutes || 0},
          'google_meet'::attendance_source,
          ${attendanceStatus(record.durationMinutes || 0)}::attendance_status,
          ${record.participantEmail || null},
          ${record.participantName || null},
          ${record.googleParticipantId || null},
          ${record.googleSessionId || null},
          ${JSON.stringify(record.raw || {})}::jsonb
        )
        ON CONFLICT (lecture_id, user_id)
        DO UPDATE SET
          joined_at = EXCLUDED.joined_at,
          left_at = EXCLUDED.left_at,
          duration_minutes = EXCLUDED.duration_minutes,
          source = EXCLUDED.source,
          status = EXCLUDED.status,
          participant_email = EXCLUDED.participant_email,
          participant_name = EXCLUDED.participant_name,
          google_participant_id = EXCLUDED.google_participant_id,
          google_session_id = EXCLUDED.google_session_id,
          meet_raw = EXCLUDED.meet_raw,
          updated_at = NOW()
      `;
      synced += 1;
    }

    const [coordinatorAttendance, teacherAttendance] = await Promise.all([
      lecture.coordinator_user_id
        ? prisma.$queryRaw`
            SELECT
              la.joined_at,
              la.left_at,
              COALESCE(la.duration_minutes, 0) AS duration_minutes,
              COALESCE(la.status::text, 'absent') AS status,
              la.participant_email,
              la.participant_name
            FROM lecture_attendance la
            WHERE la.lecture_id = ${id}::uuid
              AND la.user_id = ${lecture.coordinator_user_id}::uuid
            LIMIT 1
          `
        : Promise.resolve([]),
      prisma.$queryRaw`
        SELECT
          la.joined_at,
          la.left_at,
          COALESCE(la.duration_minutes, 0) AS duration_minutes,
          COALESCE(la.status::text, 'absent') AS status,
          la.participant_email,
          la.participant_name
        FROM lecture_attendance la
        WHERE la.lecture_id = ${id}::uuid
          AND la.user_id = ${lecture.teacher_user_id}::uuid
        LIMIT 1
      `,
    ]);

    const latestRecording =
      [...(meetData.recordings || [])]
        .sort((left, right) => {
          const leftTime = new Date(left.endTime || left.startTime || 0).getTime();
          const rightTime = new Date(right.endTime || right.startTime || 0).getTime();
          return rightTime - leftTime;
        })[0] || null;

    const syncMeta = {
      synced_at: new Date().toISOString(),
      meet_space_id: meetSpaceId || "",
      conference_record_name: meetData.conferenceRecord?.name || "",
      host: {
        role: "coordinator",
        name: lecture.coordinator_name || "",
        email: lecture.coordinator_email || "",
        joined: Boolean(coordinatorAttendance?.[0]?.joined_at),
        status: coordinatorAttendance?.[0]?.status || "absent",
        joined_at: coordinatorAttendance?.[0]?.joined_at || null,
        left_at: coordinatorAttendance?.[0]?.left_at || null,
        duration_minutes: Number(coordinatorAttendance?.[0]?.duration_minutes || 0),
      },
      cohost: {
        role: "teacher",
        name: lecture.teacher_name || "",
        email: lecture.teacher_email || "",
        joined: Boolean(teacherAttendance?.[0]?.joined_at),
        status: teacherAttendance?.[0]?.status || "absent",
        joined_at: teacherAttendance?.[0]?.joined_at || null,
        left_at: teacherAttendance?.[0]?.left_at || null,
        duration_minutes: Number(teacherAttendance?.[0]?.duration_minutes || 0),
      },
      others: unmatched.map((record) => ({
        name: record.participantName || "",
        email: record.participantEmail || "",
        joined_at: record.joinedAt || null,
        left_at: record.leftAt || null,
        duration_minutes: Number(record.durationMinutes || 0),
      })),
      recording: latestRecording
        ? {
            file_id: latestRecording.driveFileId || "",
            url: latestRecording.driveExportUri || "",
            state: latestRecording.state || "",
            start_time: latestRecording.startTime || null,
            end_time: latestRecording.endTime || null,
          }
        : null,
    };

    await prisma.$executeRaw`
      UPDATE lecture_schedules
      SET google_meet_space_id = COALESCE(${meetSpaceId || null}, google_meet_space_id),
          recording_drive_file_id = COALESCE(${latestRecording?.driveFileId || null}, recording_drive_file_id),
          recording_drive_url = COALESCE(${latestRecording?.driveExportUri || null}, recording_drive_url),
          google_meet_sync_meta = ${JSON.stringify(syncMeta)}::jsonb,
          updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Meet attendance synced.", 200, {
      synced,
      unmatched_participants: unmatched,
      available: true,
      host: syncMeta.host,
      cohost: syncMeta.cohost,
      others: syncMeta.others,
      recording: syncMeta.recording,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to sync Meet attendance.", 500);
  }
}
