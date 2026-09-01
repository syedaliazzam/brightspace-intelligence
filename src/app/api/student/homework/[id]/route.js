import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { uploadHomeworkSubmissions } from "@/lib/supabaseStorage";

const ALLOWED_ROLES = ["student"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      bucket: typeof item?.bucket === "string" ? item.bucket : null,
      storedPath: typeof item?.path === "string" ? item.path : typeof item?.storedPath === "string" ? item.storedPath : null,
      name: typeof item?.name === "string" ? item.name : null,
      type: typeof item?.type === "string" ? item.type : "",
      size: Number(item?.size || 0),
    }))
    .filter((item) => item.storedPath);
}

export async function PATCH(request, { params }) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    let note = "";
    let files = [];
    let directUploads = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      note = typeof formData.get("note") === "string" ? String(formData.get("note")).trim() : "";
      files = formData.getAll("file").filter((entry) => entry instanceof File && entry.size > 0);
    } else {
      const body = await request.json().catch(() => ({}));
      note = typeof body?.note === "string" ? body.note.trim() : "";
      directUploads = normalizeAttachments(body?.attachments);
    }

    if (!note) {
      return json("Submission is required.", 400);
    }

    const [homework] = await prisma.$queryRaw`
      SELECT h.id::text AS id
      FROM homework h
      INNER JOIN student_profiles sp ON sp.id = h.student_id
      WHERE h.id = ${id}::uuid
        AND sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;

    if (!homework?.id) {
      return json("Homework not found.", 404);
    }

    const uploads = directUploads.length ? directUploads : files.length ? await uploadHomeworkSubmissions({ homeworkId: id, files }) : [];
    const upload = uploads[0] || null;

    await prisma.$executeRaw`
      UPDATE homework
      SET
        status = 'submitted'::homework_status,
        submission_note = ${note}::text,
        submission_attachment_bucket = ${(upload?.bucket || null)}::text,
        submission_attachment_path = ${(upload?.storedPath || null)}::text,
        submission_attachment_name = ${(upload?.name || files[0]?.name || null)}::text,
        submission_attachment_buckets = ${JSON.stringify(uploads.map((item) => item.bucket || null))}::jsonb,
        submission_attachment_paths = ${JSON.stringify(uploads.map((item) => item.storedPath || null))}::jsonb,
        submission_attachment_names = ${JSON.stringify(uploads.map((item) => item.name || null))}::jsonb,
        submitted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    await prisma.$executeRaw`
      INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at, new_data)
      VALUES (
        gen_random_uuid(),
        ${session.user.id}::uuid,
        'homework_submitted',
        'homework',
        ${id}::uuid,
        NOW(),
        jsonb_build_object(
          'note', ${note}::text,
          'attachment_path', ${(upload?.storedPath || null)}::text,
          'attachment_name', ${(upload?.name || files[0]?.name || null)}::text,
          'attachment_paths', ${JSON.stringify(uploads.map((item) => item.storedPath || null))}::jsonb
        )
      )
    `;

    return json("Homework submitted.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to submit homework.", 500);
  }
}
