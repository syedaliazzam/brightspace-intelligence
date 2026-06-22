import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function teacherFilter(session) {
  if (String(session.user.role).toLowerCase() === "admin") return { id: "", where: "", values: [] };
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${session.user.id}::uuid LIMIT 1
  `;
  if (!teacher?.id) throw new Error("Teacher profile not found.");
  return { id: teacher.id, where: "WHERE h.teacher_id = $1::uuid", values: [teacher.id] };
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const filter = await teacherFilter(session);
    const items = await prisma.$queryRawUnsafe(
      `
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.lecture_id::text AS lecture_id,
        su.full_name AS student_name,
        sub.name AS subject_name
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN users su ON su.id = sp.user_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      ${filter.where}
      ORDER BY h.created_at DESC
      `,
      ...filter.values
    );
    return json("Homework fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const lectureId = clean(body?.lectureId);
    const title = clean(body?.title);
    const description = clean(body?.description);
    const dueDate = clean(body?.dueDate);
    if (!lectureId || !title) return json("Lecture and homework title are required.", 400);

    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const [lecture] = isAdmin
      ? await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.student_id::text AS student_id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id
          FROM lecture_schedules ls
          WHERE ls.id = ${lectureId}::uuid
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT ls.id::text AS id, ls.student_id::text AS student_id, ls.teacher_id::text AS teacher_id, ls.subject_id::text AS subject_id
          FROM lecture_schedules ls
          INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
          WHERE ls.id = ${lectureId}::uuid
            AND tp.user_id = ${session.user.id}::uuid
          LIMIT 1
        `;
    if (!lecture?.id) return json("Assigned lecture not found.", 404);

    const [created] = await prisma.$queryRaw`
      INSERT INTO homework (id, lecture_id, student_id, teacher_id, subject_id, title, description, due_date, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${lectureId}::uuid, ${lecture.student_id}::uuid, ${lecture.teacher_id}::uuid, ${lecture.subject_id}::uuid, ${title}, ${description || null}, ${dueDate || null}::date, 'pending'::homework_status, NOW(), NOW())
      RETURNING id::text AS id
    `;
    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
      VALUES (gen_random_uuid(), ${session.user.id}::uuid, 'homework_created', 'homework', ${created.id}::uuid, NOW())
    `;
    return json("Homework created.", 201, { item: created });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to create homework.", 500);
  }
}
