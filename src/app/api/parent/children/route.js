import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function getChildren(session) {
  const role = String(session?.user?.role || "").toLowerCase();

  if (role === "admin") {
    return prisma.$queryRaw`
      SELECT
        sp.id::text AS id,
        sp.user_id::text AS user_id,
        u.full_name,
        u.username,
        u.email,
        u.phone,
        sp.age,
        sp.grade_level,
        sp.status::text AS status,
        sp.created_at,
        c.title AS course_title,
        rl.student_name AS lead_student_name,
        rl.parent_relation,
        rl.program_name,
        rl.current_school,
        rl.current_grade,
        rl.gender,
        rl.date_of_birth,
        rl.city_country,
        rl.nationality,
        rl.religion,
        rl.preferred_language,
        rl.child_profile,
        rl.child_strengths,
        rl.child_support_needs,
        rl.child_special_interests,
        rl.developmental_concern,
        rl.developmental_concern_details,
        rl.medical_conditions,
        rl.support_person_during_learning,
        rl.device_available,
        rl.school_expectations
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      ORDER BY u.full_name ASC
    `;
  }

  return prisma.$queryRaw`
    SELECT
      sp.id::text AS id,
      sp.user_id::text AS user_id,
      u.full_name,
      u.username,
      u.email,
      u.phone,
      sp.age,
      sp.grade_level,
      sp.status::text AS status,
      sp.created_at,
      c.title AS course_title,
      rl.student_name AS lead_student_name,
      rl.parent_relation,
      rl.program_name,
      rl.current_school,
      rl.current_grade,
      rl.gender,
      rl.date_of_birth,
      rl.city_country,
      rl.nationality,
      rl.religion,
      rl.preferred_language,
      rl.child_profile,
      rl.child_strengths,
      rl.child_support_needs,
      rl.child_special_interests,
      rl.developmental_concern,
      rl.developmental_concern_details,
      rl.medical_conditions,
      rl.support_person_during_learning,
      rl.device_available,
      rl.school_expectations
    FROM parent_profiles pp
    INNER JOIN student_parents spp ON spp.parent_id = pp.id
    INNER JOIN student_profiles sp ON sp.id = spp.student_id
    INNER JOIN users u ON u.id = sp.user_id
    LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status) = 'active'
    LEFT JOIN courses c ON c.id = e.course_id
    LEFT JOIN registration_leads rl ON rl.id = e.registration_id
    WHERE pp.user_id = ${session.user.id}::uuid
    ORDER BY spp.is_primary DESC, u.full_name ASC
  `;
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const children = await getChildren(session);
    return json("Children fetched.", 200, { children });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load children.", 500);
  }
}
