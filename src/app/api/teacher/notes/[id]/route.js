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

async function canAccessNote(session, id) {
  const isAdmin = String(session.user.role).toLowerCase() === "admin";
  if (isAdmin) {
    return prisma.$queryRaw`
      SELECT tn.id::text AS id
      FROM teacher_notes tn
      WHERE tn.id = ${id}::uuid
      LIMIT 1
    `;
  }

  return prisma.$queryRaw`
    SELECT tn.id::text AS id
    FROM teacher_notes tn
    INNER JOIN teacher_profiles tp ON tp.id = tn.teacher_id
    WHERE tn.id = ${id}::uuid
      AND tp.user_id = ${session.user.id}::uuid
    LIMIT 1
  `;
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const note = clean(body?.note);
    const visibility = clean(body?.visibility).toLowerCase();

    const [row] = await canAccessNote(session, id);
    if (!row?.id) return json("Note not found.", 404);

    const updates = [];
    if (note) updates.push(prisma.$executeRaw`UPDATE teacher_notes SET note = ${note} WHERE id = ${id}::uuid`);
    if (visibility) updates.push(prisma.$executeRaw`UPDATE teacher_notes SET visibility = ${visibility} WHERE id = ${id}::uuid`);
    if (!updates.length) return json("No fields to update.", 400);

    await Promise.all(updates);
    return json("Note updated.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update note.", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const [row] = await canAccessNote(session, id);
    if (!row?.id) return json("Note not found.", 404);

    await prisma.$executeRaw`
      DELETE FROM teacher_notes
      WHERE id = ${id}::uuid
    `;
    return json("Note deleted.");
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to delete note.", 500);
  }
}
