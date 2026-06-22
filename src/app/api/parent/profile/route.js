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
        pp.relation
      FROM users u
      LEFT JOIN parent_profiles pp ON pp.user_id = u.id
      WHERE u.id = ${session.user.id}::uuid
      LIMIT 1
    `;

    return json("Profile fetched.", 200, { profile });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load profile.", 500);
  }
}
