import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["superadmin", "admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function DELETE(_request, context) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  const params = await context?.params;
  const id = String(params?.id || "").trim();
  if (!id) return json("Interested student id is required.", 400);

  try {
    const [lead] = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        COALESCE(NULLIF(TRIM(admission_form_status), ''), 'pending') AS admission_form_status,
        COALESCE(NULLIF(TRIM(status), ''), 'new') AS status
      FROM interested_students
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    if (!lead?.id) {
      return json("Interested student not found.", 404);
    }

    const leadStatus = String(lead.admission_form_status || lead.status || "new").toLowerCase();
    const canDelete = !["sent", "submitted", "reminded", "overdue", "not_submitted"].includes(leadStatus);

    if (!canDelete) {
      return json("This record can no longer be deleted.", 400);
    }

    const interviewForms = await prisma.$queryRaw`
      SELECT id::text AS id
      FROM parent_interview_forms
      WHERE registration_id = ${id}
         OR registration_id = ${id}::text
      ORDER BY created_at DESC NULLS LAST
    `;

    await prisma.$transaction(async (tx) => {
      if (Array.isArray(interviewForms) && interviewForms.length) {
        for (const interview of interviewForms) {
          await tx.$executeRaw`
            DELETE FROM parent_interview_forms
            WHERE id = ${interview.id}::uuid
          `;
        }
      }

      await tx.$executeRaw`
        DELETE FROM interested_students
        WHERE id = ${id}::uuid
      `;
    });

    return json("Interested student deleted.", 200, { success: true });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to delete interested student.", 500);
  }
}
