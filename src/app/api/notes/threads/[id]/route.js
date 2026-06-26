import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = ["teacher", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function canManageThread(session, id) {
  const role = String(session.user.role || "").toLowerCase();
  if (role === "admin") {
    return prisma.$queryRaw`
      SELECT nt.id::text AS id
      FROM note_threads nt
      WHERE nt.id = ${id}::uuid
      LIMIT 1
    `;
  }
  return prisma.$queryRaw`
    SELECT nt.id::text AS id
    FROM note_threads nt
    INNER JOIN teacher_profiles tp ON tp.id = nt.teacher_id
    WHERE nt.id = ${id}::uuid
      AND tp.user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const note = clean(body?.message || body?.note);
    const visibility = clean(body?.visibility).toLowerCase();

    const [row] = await canManageThread(session, id);
    if (!row?.id) return json("Thread not found.", 404);

    if (!note && !visibility) return json("No fields to update.", 400);

    if (note) {
      const [latest] = await prisma.$queryRaw`
        SELECT id::text AS id
        FROM note_thread_messages
        WHERE thread_id = ${id}::uuid
          AND sender_user_id = ${session.user.id}::uuid
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (!latest?.id) return json("No editable note found.", 404);
      await prisma.$executeRaw`
        UPDATE note_thread_messages
        SET message = ${note},
            updated_at = NOW()
        WHERE id = ${latest.id}::uuid
      `;
    }

    if (visibility) {
      await prisma.$executeRaw`
        UPDATE note_threads
        SET visibility = ${visibility},
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }

    return json("Thread updated.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update thread.", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const [row] = await canManageThread(session, id);
    if (!row?.id) return json("Thread not found.", 404);
    await prisma.$executeRaw`DELETE FROM note_threads WHERE id = ${id}::uuid`;
    return json("Thread deleted.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to delete thread.", 500);
  }
}
