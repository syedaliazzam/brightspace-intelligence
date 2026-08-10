import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const isAdmin = String(session.user.role).toLowerCase() === "admin";
    const conditions = ["ta.status::text = 'active'", "LOWER(e.status::text) = 'active'"];
    const values = [];
    if (!isAdmin) {
      values.push(session.user.id);
      conditions.push(`tp.user_id = $${values.length}::uuid`);
    }
    const where = `WHERE ${conditions.join(" AND ")}`;
    const rawItems = await prisma.$queryRawUnsafe(
      `
      WITH matched AS (
        SELECT
          sp.id::text AS id,
          su.full_name,
          su.username,
          su.email,
          su.phone,
          rl.child_photograph_file_path AS profile_picture_path,
          sp.age,
          sp.grade_level,
          sp.status::text AS status,
          sub.name AS subject_name,
          COALESCE(NULLIF(c.class_level, ''), c.title) AS course_title
        FROM teacher_assignments ta
        INNER JOIN teacher_profiles tp ON tp.id = ta.teacher_id
        INNER JOIN courses c ON c.id = ta.course_id
        INNER JOIN enrollments e ON e.course_id = c.id
        INNER JOIN student_profiles sp ON sp.id = e.student_id
        INNER JOIN users su ON su.id = sp.user_id
        INNER JOIN subjects sub ON sub.id = ta.subject_id
        LEFT JOIN registration_leads rl ON rl.id = e.registration_id
        ${where}
      )
      SELECT
        id,
        MAX(full_name) AS full_name,
        MAX(username) AS username,
        MAX(email) AS email,
        MAX(phone) AS phone,
        MAX(profile_picture_path) AS profile_picture_path,
        MAX(age) AS age,
        MAX(grade_level) AS grade_level,
        MAX(status) AS status,
        STRING_AGG(DISTINCT subject_name, ', ' ORDER BY subject_name) AS subject_name,
        STRING_AGG(DISTINCT course_title, ', ' ORDER BY course_title) AS course_title
      FROM matched
      GROUP BY id
      ORDER BY MAX(full_name) ASC
      `,
      ...values
    );
    const items = await Promise.all(
      (Array.isArray(rawItems) ? rawItems : []).map(async (item) => ({
        ...item,
        profile_picture_url: item?.profile_picture_path
          ? await createSignedAdmissionDocumentUrl(item.profile_picture_path).catch(() => "")
          : "",
      }))
    );
    return json("Students fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load students.", 500);
  }
}
