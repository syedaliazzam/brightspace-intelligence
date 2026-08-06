import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { buildLectureJoinEmailHtml, getAppUrl, sendEmail } from "@/lib/email";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function sendNextLectureEmail(lecture) {
  if (!lecture?.course_id || !lecture?.teacher_id || !lecture?.subject_id || !lecture?.scheduled_end) return;

  const endedAt = new Date(String(lecture.scheduled_end).includes("T") ? lecture.scheduled_end : String(lecture.scheduled_end).replace(" ", "T"));
  if (Number.isNaN(endedAt.getTime()) || endedAt.getTime() > Date.now()) {
    return;
  }

  const [nextLecture] = await prisma.$queryRaw`
    SELECT
      ls.id::text AS id,
      e.course_id::text AS course_id,
      ls.title,
      ls.scheduled_start::text AS scheduled_start,
      ls.google_meet_link,
      sub.name AS subject_name,
      su.full_name AS student_name,
      su.email AS student_email,
      pu.full_name AS parent_name,
      pu.email AS parent_email,
      tu.full_name AS teacher_name,
      tu.email AS teacher_email
    FROM lecture_schedules ls
    INNER JOIN enrollments e ON e.id = ls.enrollment_id
    INNER JOIN student_profiles sp ON sp.id = ls.student_id
    INNER JOIN users su ON su.id = sp.user_id
    LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
    LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
    LEFT JOIN users pu ON pu.id = pp.user_id
    INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
    INNER JOIN users tu ON tu.id = tp.user_id
    INNER JOIN subjects sub ON sub.id = ls.subject_id
    WHERE e.course_id = ${lecture.course_id}::uuid
      AND ls.teacher_id = ${lecture.teacher_id}::uuid
      AND ls.subject_id = ${lecture.subject_id}::uuid
      AND ls.title = ${lecture.title}
      AND ls.scheduled_start > ${lecture.scheduled_start}::timestamp
      AND LOWER(ls.status::text) IN ('scheduled', 'upcoming')
    ORDER BY ls.scheduled_start ASC
    LIMIT 1
  `;

  if (!nextLecture?.id) return;

  const baseUrl = getAppUrl();
  const recipientList = [];
  if (nextLecture.teacher_email) {
    recipientList.push({
      email: nextLecture.teacher_email,
      name: nextLecture.teacher_name,
      portalUrl: `${baseUrl}/teacher/dashboard`,
      studentName: nextLecture.student_name,
      subjectName: nextLecture.subject_name,
    });
  }
  const parentRows = await prisma.$queryRaw`
    SELECT DISTINCT
      pu.email AS email,
      pu.full_name AS name
    FROM enrollments e
    INNER JOIN student_parents spp ON spp.student_id = e.student_id AND spp.is_primary = TRUE
    INNER JOIN parent_profiles pp ON pp.id = spp.parent_id
    INNER JOIN users pu ON pu.id = pp.user_id
    WHERE e.course_id = ${nextLecture.course_id}::uuid
      AND LOWER(e.status) = 'active'
      AND pu.email IS NOT NULL
      AND TRIM(pu.email) <> ''
  `;

  for (const parent of parentRows || []) {
    recipientList.push({
      email: parent.email,
      name: parent.name || nextLecture.parent_name,
      portalUrl: `${baseUrl}/parent/lectures`,
      studentName: nextLecture.student_name,
      subjectName: nextLecture.subject_name,
    });
  }

  for (const recipient of recipientList) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: "Next lecture is now available",
        html: buildLectureJoinEmailHtml({
          recipientName: recipient.name,
          lectureTitle: nextLecture.title,
          studentName: recipient.studentName,
          subjectName: recipient.subjectName,
          scheduledStart: nextLecture.scheduled_start,
          portalUrl: recipient.portalUrl,
          meetLink: nextLecture.google_meet_link,
        }),
      });
    } catch (error) {
      console.warn("[teacher-lectures] Next lecture email failed:", error instanceof Error ? error.message : String(error));
    }
  }
}

export async function POST(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json();
    const summary = clean(body?.summary);
    const topicCovered = clean(body?.topicCovered);
    const homeworkGiven = clean(body?.homeworkGiven);
    const studentPerformance = clean(body?.studentPerformance);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            e.course_id::text AS course_id,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end,
            ls.google_calendar_event_id,
            ls.google_meet_link
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          WHERE ls.id = ${id}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT
            ls.id::text AS id,
            e.course_id::text AS course_id,
            ls.teacher_id::text AS teacher_id,
            ls.subject_id::text AS subject_id,
            ls.title,
            ls.scheduled_start::text AS scheduled_start,
            ls.scheduled_end::text AS scheduled_end,
            ls.google_calendar_event_id,
            ls.google_meet_link
          FROM lecture_schedules ls
          INNER JOIN enrollments e ON e.id = ls.enrollment_id
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${id}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Lecture not found.", 404);

    await prisma.$executeRaw`
      INSERT INTO lecture_completion_reports (
        id, lecture_id, teacher_id, summary, topic_covered, homework_given, student_performance, submitted_at, created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), ${id}::uuid, ${lecture.teacher_id}::uuid, ${summary || null}, ${topicCovered || null}, ${homeworkGiven || null}, ${studentPerformance || null}, NOW(), NOW(), NOW()
      )
      ON CONFLICT (lecture_id)
      DO UPDATE SET
        summary = ${summary || null},
        topic_covered = ${topicCovered || null},
        homework_given = ${homeworkGiven || null},
        student_performance = ${studentPerformance || null},
        submitted_at = NOW(),
        updated_at = NOW()
    `;
    await prisma.$executeRaw`
      UPDATE lecture_schedules ls
      SET status = 'completed_by_teacher'::lecture_status, updated_at = NOW()
      WHERE ls.id = ${id}::uuid
    `;
    await sendNextLectureEmail(lecture).catch((error) => {
      console.warn("[teacher-lectures] Failed to send next lecture email:", error instanceof Error ? error.message : String(error));
    });
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'completion_report_submitted', 'lecture_schedules', ${id}::uuid, NOW())
    `;
    return json("Completion report submitted.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to submit completion report.", 500);
  }
}
