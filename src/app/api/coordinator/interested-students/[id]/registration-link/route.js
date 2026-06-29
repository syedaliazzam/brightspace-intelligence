import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function POST(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const { id } = await params;
    const [row] = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        registration_token,
        registration_lead_id::text AS registration_lead_id,
        LOWER(status::text) AS status
      FROM interested_students
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!row?.id) return json("Interested student not found.", 404);

    const token = row.registration_token || crypto.randomUUID().replace(/-/g, "");
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      request.nextUrl.origin;
    const registrationLink = `${appUrl.replace(/\/+$/, "")}/admission-form?leadToken=${encodeURIComponent(token)}`;
    const generatedAt = new Date();
    const generatedBy = session?.user?.id || null;
    const alreadyGenerated = Boolean(row.registration_token);

    if (!alreadyGenerated) {
      await prisma.$executeRaw`
        UPDATE interested_students
        SET
          registration_token = ${token},
          status = ${"link_generated"},
          registration_link_generated_at = ${generatedAt},
          registration_link_generated_by = CAST(${generatedBy || null} AS uuid),
          updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    return json("Registration link generated.", 200, {
      success: true,
      already_generated: alreadyGenerated,
      registration_link: registrationLink,
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to generate registration link.", 500);
  }
}
