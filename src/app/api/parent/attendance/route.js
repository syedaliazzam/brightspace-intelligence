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
    const visibilityFilter = "COALESCE(ls.status::text, '') = 'verified_by_coordinator'";
    const whereClause = where
      ? `${where} AND ${visibilityFilter}`
      : `WHERE ${visibilityFilter}`;

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT
        la.id::text AS id,
        la.status::text AS status,
        la.joined_at,
        la.left_at,
        la.duration_minutes,
        ls.title AS class_title,
        ls.scheduled_start,
        ls.scheduled_end,
        sub.name AS subject_name,
        su.full_name AS student_name
      FROM lecture_attendance la
      INNER JOIN users student_user ON student_user.id = la.user_id
      INNER JOIN student_profiles sp ON sp.user_id = student_user.id
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = la.lecture_id
      LEFT JOIN subjects sub ON sub.id = ls.subject_id
      ${joins}
      ${whereClause}
      ORDER BY COALESCE(ls.scheduled_start, la.created_at) DESC
      `,
      ...values
    );

    const total = rows.length;
    const present = rows.filter((row) => row.status === "present").length;

    return json("Attendance fetched.", 200, {
      items: rows,
      summary: {
        total,
        present,
        percentage: total ? Math.round((present / total) * 100) : 0,
      },
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load attendance.", 500);
  }
}
