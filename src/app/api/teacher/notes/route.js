import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];
const VISIBILITY = new Set(["parent", "student", "admin_only"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const where = isAdmin ? "" : "WHERE tp.user_id = $1::uuid";
    const values = isAdmin ? [] : [session.user.id];
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        tn.id::text AS id,
        tn.note,
        tn.visibility,
        tn.created_at,
        ls.title AS lecture_title,
        su.full_name AS student_name
      FROM teacher_notes tn
      INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
      INNER JOIN student_profiles sp ON sp.id = tn.student_id
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = tn.lecture_id
      ${where}
      ORDER BY tn.created_at DESC
      `,
      ...values
    );
    return json("Notes fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load notes.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const lectureId = clean(body?.lectureId);
    const note = clean(body?.note);
    const visibility = VISIBILITY.has(clean(body?.visibility)) ? clean(body?.visibility) : "parent";
    if (!lectureId || !note) return json("Lecture and note are required.", 400);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.student_id::text AS student_id, ls.teacher_id::text AS teacher_id
          FROM lecture_schedules ls
          WHERE ls.id = ${lectureId}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.student_id::text AS student_id, ls.teacher_id::text AS teacher_id
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Assigned lecture not found.", 404);

    const [created] = await prisma.$queryRaw`
      INSERT INTO teacher_notes (id, lecture_id, teacher_id, student_id, note, visibility, created_at)
      VALUES (gen_random_uuid(), ${lectureId}::uuid, ${lecture.teacher_id}::uuid, ${lecture.student_id}::uuid, ${note}, ${visibility}, NOW())
      RETURNING id::text AS id
    `;
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'teacher_note_added', 'teacher_notes', ${created.id}::uuid, NOW())
    `;
    return json("Teacher note added.", 201, { item: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to add note.", 500);
  }
}
