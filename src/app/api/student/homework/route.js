import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { createSignedAdmissionDocumentUrl, createSignedHomeworkSubmissionUrls } from "@/lib/supabaseStorage";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function ensureHomeworkAttachmentColumns() {
  await prisma.$executeRaw`
    ALTER TABLE homework
    ADD COLUMN IF NOT EXISTS homework_attachment_buckets jsonb,
    ADD COLUMN IF NOT EXISTS homework_attachment_paths jsonb,
    ADD COLUMN IF NOT EXISTS homework_attachment_names jsonb
  `;
}

export async function GET() {
  try {
    const session = await requireRole(["student"]);
    await ensureHomeworkAttachmentColumns();
    const items = await prisma.$queryRaw`
      SELECT
        h.id::text AS id,
        h.title,
        h.description,
        h.due_date,
        h.status::text AS status,
        h.created_at,
        h.homework_attachment_path,
        h.homework_attachment_name,
        h.homework_attachment_paths,
        h.homework_attachment_names,
        ls.title AS lecture_title,
        sub.name AS subject_name,
        tu.full_name AS teacher_name
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      INNER JOIN subjects sub ON sub.id = h.subject_id
      INNER JOIN teacher_profiles tp ON tp.id = h.teacher_id
      INNER JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN lecture_schedules ls ON ls.id = h.lecture_id
      WHERE sp.user_id = ${session.user.id}::uuid
      ORDER BY h.created_at DESC
    `;
    const enriched = await Promise.all(items.map(async (item) => ({
      ...item,
      homework_attachment_url: item.homework_attachment_path
        ? await createSignedAdmissionDocumentUrl(item.homework_attachment_path)
        : "",
      homework_attachment_urls: await createSignedHomeworkSubmissionUrls(
        Array.isArray(item.homework_attachment_paths) ? item.homework_attachment_paths : []
      ),
    })));
    return json("Homework fetched.", 200, { items: enriched });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load homework.", 500);
  }
}
