import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    const [profile] = await prisma.$queryRaw`
      SELECT
        u.full_name,
        COALESCE(
          NULLIF(TRIM(u.username), ''),
          NULLIF(REGEXP_REPLACE(COALESCE(u.email, ''), '@students\\.lms$', '', 'i'), ''),
          NULLIF(TRIM(u.email), '')
        ) AS username,
        u.email,
        u.phone,
        u.status::text AS user_status,
        sp.id::text AS student_id,
        sp.admission_no,
        sp.age,
        sp.grade_level,
        sp.status::text AS profile_status,
        c.title AS course_title,
        pu.full_name AS father_name,
        pu.phone AS father_phone
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND e.status = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}

export async function PATCH(request) {
  try {
    const session = await requireRole(["student"]);
    const body = await request.json();
    const fullName = normalizeText(body?.fullName);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const password = normalizeText(body?.password);

    if (!fullName) {
      return json("Full name is required.", 400);
    }
    if (email && !isValidEmail(email)) {
      return json("A valid email is required.", 400);
    }

    const updates = [];
    const values = [];

    values.push(fullName);
    updates.push(`full_name = $${values.length}`);

    if (email) {
      values.push(email);
      updates.push(`email = $${values.length}`);
    }

    if (phone) {
      values.push(phone);
      updates.push(`phone = $${values.length}`);
    }

    if (password) {
      values.push(password);
      updates.push(`password_hash = $${values.length}`);
    }

    if (!updates.length) {
      return json("No profile fields were provided to update.", 400);
    }

    values.push(session.user.id);
    const updateSql = `UPDATE users SET ${updates.join(", ")} WHERE id = $${values.length}::uuid`;

    await prisma.$executeRawUnsafe(updateSql, ...values);

    const [profile] = await prisma.$queryRaw`
      SELECT
        u.full_name,
        COALESCE(
          NULLIF(TRIM(u.username), ''),
          NULLIF(REGEXP_REPLACE(COALESCE(u.email, ''), '@students\\.lms$', '', 'i'), ''),
          NULLIF(TRIM(u.email), '')
        ) AS username,
        u.email,
        u.phone,
        u.status::text AS user_status,
        sp.id::text AS student_id,
        sp.admission_no,
        sp.age,
        sp.grade_level,
        sp.status::text AS profile_status,
        c.title AS course_title,
        pu.full_name AS father_name,
        pu.phone AS father_phone
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND e.status = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;

    return json("Profile updated.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to update profile.", 500);
  }
}
