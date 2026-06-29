import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["parent", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const [profile] = await prisma.$queryRaw`
      SELECT
        u.id::text AS user_id,
        u.full_name,
        u.email,
        u.phone,
        u.status::text AS status,
        pp.id::text AS parent_profile_id,
        CASE
          WHEN LOWER(COALESCE(pp.relation, '')) IN ('', 'parent')
            THEN COALESCE(NULLIF(latest_registration.parent_relation, ''), COALESCE(pp.relation, ''))
          ELSE COALESCE(pp.relation, '')
        END AS relation
      FROM users u
      LEFT JOIN parent_profiles pp ON pp.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT rl.parent_relation
        FROM student_parents spp
        INNER JOIN enrollments e ON e.student_id = spp.student_id
        INNER JOIN registration_leads rl ON rl.id = e.registration_id
        WHERE spp.parent_id = pp.id
        ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, rl.created_at DESC NULLS LAST
        LIMIT 1
      ) latest_registration ON TRUE
      WHERE u.id = ${session.user.id}::uuid
      LIMIT 1
    `;

    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}
