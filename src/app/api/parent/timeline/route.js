import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const childId = String(searchParams.get("childId") || "").trim();
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const joins = isAdmin ? "" : "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id";
    const where = isAdmin
      ? childId ? "WHERE sp.id = $1::uuid" : ""
      : childId ? "WHERE pp.user_id = $1::uuid AND sp.id = $2::uuid" : "WHERE pp.user_id = $1::uuid";
    const values = isAdmin ? childId ? [childId] : [] : childId ? [session.user.id, childId] : [session.user.id];

    const classes = await prisma.$queryRawUnsafe(
      `
      WITH allowed_students AS (
        SELECT sp.id, u.full_name
        FROM student_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        ${String(session.user.role).toLowerCase() === "admin" ? "" : "INNER JOIN student_parents spp ON spp.student_id = sp.id INNER JOIN parent_profiles pp ON pp.id = spp.parent_id"}
        ${where}
      )
      SELECT DISTINCT
        ls.id::text AS id,
        ls.title,
        ls.status::text AS status,
        ls.scheduled_start AS occurred_at,
        ls.google_meet_link,
        ls.recording_drive_url,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        a.full_name AS student_name
      FROM lecture_schedules ls
      INNER JOIN enrollments e ON e.id = ls.enrollment_id
      INNER JOIN allowed_students a ON (
        ls.student_id = a.id
        OR e.student_id = a.id
        OR e.course_id IN (
          SELECT course_id
          FROM enrollments
          WHERE student_id = a.id
            AND LOWER(status) = 'active'
        )
      )
      INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = ls.subject_id
      ORDER BY ls.scheduled_start ASC
      `,
      ...values
    );

    const notes = await prisma.$queryRawUnsafe(
      `
      SELECT
        tn.id::text AS id,
        tn.note,
        tn.created_at,
        tu.full_name AS teacher_name,
        su.full_name AS student_name
      FROM teacher_notes tn
      INNER JOIN student_profiles sp ON sp.id = tn.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      ${joins}
      ${where}
        ${where ? "AND" : "WHERE"} COALESCE(tn.visibility, 'parent') IN ('parent', 'student')
      ORDER BY tn.created_at ASC
      LIMIT 20
      `,
      ...values
    );

    const homeworks = await prisma.$queryRawUnsafe(
      `
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        sub.name AS subject_name,
        tu.full_name AS teacher_name,
        su.full_name AS student_name
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      ${joins}
      ${where}
      ORDER BY h.created_at ASC
      LIMIT 20
      `,
      ...values
    );

    return json("Timeline fetched.", 200, { items: classes, notes, homeworks });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load timeline.", 500);
  }
}
