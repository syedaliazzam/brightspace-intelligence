import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const items = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        student_name,
        parent_name,
        email,
        phone,
        source,
        LOWER(status::text) AS status,
        registration_token,
        registration_link_generated_at,
        registration_link_generated_by::text AS registration_link_generated_by,
        registration_lead_id::text AS registration_lead_id,
        notes,
        created_at,
        updated_at
      FROM interested_students
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;

    return json("Interested students fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to fetch interested students.", 500);
  }
}
