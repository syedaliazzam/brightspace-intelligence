import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { uploadAdmissionDocument } from "@/lib/supabaseStorage";
import crypto from "crypto";

const ALLOWED_ROLES = ["coordinator", "admin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  try {
    const items = await prisma.$queryRaw`
      SELECT
        id::text AS id,
        title,
        document_type,
        class_level,
        file_url,
        created_by::text AS created_by,
        created_at,
        updated_at,
        is_active
      FROM educational_documents
      WHERE is_active = true
      ORDER BY created_at DESC
    `;
    return json("Educational documents fetched.", 200, { items });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load educational documents.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    const body = contentType.includes("multipart/form-data") ? await request.formData() : await request.json();
    const title = normalizeText(body?.get ? body.get("title") : body?.title);
    const documentType = normalizeText(body?.get ? body.get("documentType") : body?.documentType);
    const classLevel = normalizeText(body?.get ? body.get("classLevel") : body?.classLevel || "");
    const fileValue = body?.get ? body.get("file") : body?.file;
    const fileUrl = normalizeText(body?.get ? body.get("fileUrl") : body?.fileUrl);

    if (!title) return json("Document title is required.", 400);
    if (!documentType) return json("Document type is required.", 400);
    if (!(fileValue instanceof File) && !fileUrl) return json("Document file is required.", 400);

    const documentId = crypto.randomUUID();
    let storedFileUrl = fileUrl;

    if (fileValue instanceof File && fileValue.size) {
      const upload = await uploadAdmissionDocument({
        applicationId: documentId,
        documentType,
        file: fileValue,
      });
      storedFileUrl = upload.storedPath;
    }

    const [result] = await prisma.$queryRaw`
      INSERT INTO educational_documents (id, title, document_type, class_level, file_url, created_by, created_at, updated_at, is_active)
      VALUES (${documentId}::uuid, ${title}, ${documentType}, ${classLevel || null}, ${storedFileUrl}, ${session.user.id}::uuid, NOW(), NOW(), true)
      RETURNING id::text AS id, title, document_type, class_level, file_url, created_at
    `;

    return json("Educational document created successfully.", 201, { item: result });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to create educational document.", 500);
  }
}

export async function PATCH(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    const contentType = String(request.headers.get("content-type") || "").toLowerCase();
    const body = contentType.includes("multipart/form-data") ? await request.formData() : await request.json();
    const id = normalizeText(body?.get ? body.get("id") : body?.id);
    const title = normalizeText(body?.get ? body.get("title") : body?.title);
    const documentType = normalizeText(body?.get ? body.get("documentType") : body?.documentType);
    const classLevel = normalizeText(body?.get ? body.get("classLevel") : body?.classLevel || "");
    const fileValue = body?.get ? body.get("file") : body?.file;
    const fileUrl = normalizeText(body?.get ? body.get("fileUrl") : body?.fileUrl);

    if (!id) return json("Document ID is required.", 400);
    if (!title) return json("Document title is required.", 400);
    if (!documentType) return json("Document type is required.", 400);

    const [existing] = await prisma.$queryRaw`
      SELECT file_url
      FROM educational_documents
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    let storedFileUrl = fileUrl || normalizeText(existing?.file_url);
    if (fileValue instanceof File && fileValue.size) {
      const upload = await uploadAdmissionDocument({
        applicationId: id,
        documentType,
        file: fileValue,
      });
      storedFileUrl = upload.storedPath;
    }

    if (!storedFileUrl) return json("Document file is required.", 400);

    await prisma.$executeRaw`
      UPDATE educational_documents
      SET
        title = ${title},
        document_type = ${documentType},
        class_level = ${classLevel || null},
        file_url = ${storedFileUrl},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Educational document updated successfully.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to update educational document.", 500);
  }
}

export async function DELETE(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const id = normalizeText(body?.id);

    if (!id) return json("Document ID is required.", 400);

    await prisma.$executeRaw`
      UPDATE educational_documents
      SET is_active = false, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Educational document deleted successfully.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to delete educational document.", 500);
  }
}
