import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const items = await prisma.$queryRaw`
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.created_at,
        ls.title AS lecture_title,
        sub.name AS subject_name,
        tu.full_name AS teacher_name
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = h.lecture_id
      WHERE sp.user_id = ${session.user.id}::uuid
      ORDER BY h.created_at DESC
    `;
    return json("Homework fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}
