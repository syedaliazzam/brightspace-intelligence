import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function requireAdminSession() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) {
    return { error: json("Unauthorized.", 401) };
  }

  if (role !== "admin" && role !== "superadmin") {
    return { error: json("Forbidden.", 403) };
  }

  return { session };
}

export async function GET() {
  const authState = await requireAdminSession();

  if (authState.error) {
    return authState.error;
  }

  try {
    const items = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        title,
        COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), '')) AS class_level
      FROM courses
      WHERE COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), '')) IS NOT NULL
        AND LOWER(status::text) = 'active'
      ORDER BY COALESCE(NULLIF(TRIM(class_level), ''), NULLIF(TRIM(title), '')) ASC
    `;

    return json("Class levels fetched.", 200, { success: true, items });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to fetch class levels.",
      500
    );
  }
}
