import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ALLOWED_CLASS_LEVELS } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];
const CLASS_LEVELS = [...ALLOWED_CLASS_LEVELS];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const items = await prisma.$queryRaw(
      Prisma.sql`
        SELECT
          id::text AS id,
          COALESCE(NULLIF(class_level, ''), title) AS title
        FROM courses
        WHERE COALESCE(status, 'active'::user_status) = 'active'::user_status
          AND COALESCE(NULLIF(class_level, ''), title) IN (${Prisma.join(CLASS_LEVELS)})
        ORDER BY
          CASE COALESCE(NULLIF(class_level, ''), title)
            WHEN 'Pre-Nursery' THEN 1
            WHEN 'Nursery' THEN 2
            WHEN 'KG-1' THEN 3
            WHEN 'KG-2' THEN 4
            ELSE 5
          END
      `
    );

    return json("Classes fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;

    return json(error instanceof Error ? error.message : "Unable to fetch classes.", 500);
  }
}
