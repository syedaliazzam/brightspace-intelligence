import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["coordinator", "admin", "superadmin", "teacher", "parent"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { searchParams } = new URL(request.url);
    const portalType = (searchParams.get("portalType") || "").toLowerCase();
    const childId = String(searchParams.get("childId") || "").trim();
    
    let role = String(session?.user?.role || "").toLowerCase();
    if (portalType.includes("teacher")) {
      role = "teacher";
    } else if (portalType.includes("parent")) {
      role = "parent";
    }

    let courseQuery = `
      SELECT
        id::text AS id,
        COALESCE(NULLIF(class_level, ''), title) AS title
      FROM courses
      WHERE COALESCE(status, 'active'::user_status) = 'active'::user_status
    `;

    let subjectQuery = `
      SELECT
        s.id::text AS id,
        s.name AS title,
        cs.course_id::text AS course_id
      FROM subjects s
      JOIN course_subjects cs ON cs.subject_id = s.id
      WHERE COALESCE(s.status, 'active'::user_status) = 'active'::user_status
    `;

    const values = [];

    if (role === 'teacher') {
      values.push(session.user.id);
      courseQuery += `
        AND id IN (
          SELECT ta.course_id FROM teacher_assignments ta
          JOIN teacher_profiles tp ON tp.id = ta.teacher_id
          WHERE tp.user_id = $1::uuid 
            AND ta.status::text = 'active'
            AND ta.course_id IS NOT NULL 
        )
      `;
      subjectQuery += `
        AND EXISTS (
          SELECT 1 FROM teacher_assignments ta
          JOIN teacher_profiles tp ON tp.id = ta.teacher_id
          WHERE tp.user_id = $1::uuid
            AND ta.status::text = 'active'
            AND ta.subject_id = s.id
            AND ta.course_id = cs.course_id
        )
      `;
    } else if (role === 'parent') {
      values.push(session.user.id);
      const childParamIndex = values.length + 1;
      if (childId) values.push(childId);
      courseQuery += `
        AND id IN (
          SELECT e.course_id 
          FROM enrollments e
          JOIN student_parents p ON p.student_id = e.student_id
          JOIN student_profiles sp ON sp.id = e.student_id
          JOIN parent_profiles pp ON pp.id = p.parent_id
          WHERE pp.user_id = $1::uuid
            ${childId ? `AND e.student_id = $${childParamIndex}::uuid` : ""}
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
            AND LOWER(COALESCE(sp.status::text, 'active')) = 'active'
            AND e.course_id IS NOT NULL
        )
      `;
      subjectQuery += `
        AND cs.course_id IN (
          SELECT e.course_id 
          FROM enrollments e
          JOIN student_parents p ON p.student_id = e.student_id
          JOIN student_profiles sp ON sp.id = e.student_id
          JOIN parent_profiles pp ON pp.id = p.parent_id
          WHERE pp.user_id = $1::uuid
            ${childId ? `AND e.student_id = $${childParamIndex}::uuid` : ""}
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
            AND LOWER(COALESCE(sp.status::text, 'active')) = 'active'
            AND e.course_id IS NOT NULL
        )
      `;
    }

    courseQuery += ` ORDER BY COALESCE(NULLIF(class_level, ''), title) ASC`;
    subjectQuery += ` ORDER BY s.name ASC`;

    const classes = await prisma.$queryRawUnsafe(courseQuery, ...values);
    const subjects = await prisma.$queryRawUnsafe(subjectQuery, ...values);

    return json("Filters fetched.", 200, { classes, subjects });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to fetch filters.", 500);
  }
}
