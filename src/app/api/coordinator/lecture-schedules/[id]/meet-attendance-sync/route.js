import crypto from "crypto";
import { NextResponse } from "next/server";
import { getMeetAttendanceRecords } from "@/lib/googleMeet";
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
        ls.google_meet_space_id,
        ls.google_calendar_event_id,
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

    const meetData = await getMeetAttendanceRecords({
      meetSpaceId: lecture.google_meet_space_id,
      calendarEventId: lecture.google_calendar_event_id,
    });

    if (!meetData.available) {
      return json("Meet attendance may be available only after Google finishes processing the conference record.", 200, {
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
      email: lecture.teacher_email,
      name: lecture.teacher_name,
      attendanceUserId: lecture.teacher_user_id,
      roleType: "teacher",
    });
    addExpectedParticipant({
      email: lecture.student_email,
      name: lecture.student_name,
      attendanceUserId: lecture.student_user_id,
      roleType: "student",
    });
    addExpectedParticipant({
      email: lecture.parent_email,
      name: lecture.parent_name,
      attendanceUserId: lecture.student_user_id,
      roleType: "student",
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

    return json("Meet attendance synced.", 200, {
      synced,
      unmatched_participants: unmatched,
      available: true,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to sync Meet attendance.", 500);
  }
}
