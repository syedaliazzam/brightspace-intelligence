import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Prisma } from "@prisma/client";

const ALLOWED_ROLES = ["coordinator", "admin", "superadmin"];
const ALLOWED_ROLES_GET = ["coordinator", "admin", "superadmin", "teacher", "parent"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES_GET);
    const { searchParams } = new URL(request.url);
    const portalType = (searchParams.get("portalType") || "").toLowerCase();
    
    let role = String(session.user.role || "").toLowerCase();
    if (portalType.includes("teacher")) {
      role = "teacher";
    } else if (portalType.includes("parent")) {
      role = "parent";
    }
    
    // Teacher and parent can only see active documents
    const forceActive = role === "teacher" || role === "parent";

    let queryStr = `
      SELECT
        ld.id::text AS id,
        ld.course_id::text AS course_id,
        ld.subject_id::text AS subject_id,
        ld.doc_date,
        ld.title,
        ld.description,
        ld.status,
        ld.created_by::text AS created_by,
        ld.created_at,
        c.title AS course_title,
        c.class_level AS class_level,
        s.name AS subject_name,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', ldf.id::text,
              'file_url', ldf.file_url,
              'file_type', ldf.file_type,
              'original_name', ldf.original_name
            ))
            FROM library_document_files ldf
            WHERE ldf.library_document_id = ld.id
          ),
          '[]'::json
        ) AS files
      FROM library_documents ld
      LEFT JOIN courses c ON c.id = ld.course_id
      LEFT JOIN subjects s ON s.id = ld.subject_id
      WHERE ($1::boolean = false OR ld.status = 'active')
    `;

    const values = [forceActive];

    if (role === 'teacher') {
      values.push(session.user.id);
      queryStr += `
        AND EXISTS (
          SELECT 1 FROM teacher_assignments ta
          JOIN teacher_profiles tp ON tp.id = ta.teacher_id
          WHERE tp.user_id = $2::uuid
            AND ta.subject_id = ld.subject_id
            AND ta.course_id = ld.course_id
        )
      `;
    } else if (role === 'parent') {
      values.push(session.user.id);
      queryStr += `
        AND EXISTS (
          SELECT 1 FROM enrollments e
          JOIN student_parents p ON p.student_id = e.student_id
          JOIN parent_profiles pp ON pp.id = p.parent_id
          WHERE pp.user_id = $2::uuid
            AND e.course_id = ld.course_id
        )
      `;
    }

    queryStr += ` ORDER BY ld.doc_date DESC, ld.created_at DESC`;
    const items = await prisma.$queryRawUnsafe(queryStr, ...values);

    return json("Library documents fetched.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to load library documents.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    
    const courseId = normalizeText(body?.courseId);
    const subjectId = normalizeText(body?.subjectId);
    const docDate = normalizeText(body?.docDate);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const files = Array.isArray(body?.files) ? body.files : [];

    if (!courseId) return json("Class/Course is required.", 400);
    if (!subjectId) return json("Subject is required.", 400);
    if (!docDate) return json("Date is required.", 400);
    if (!title) return json("Title is required.", 400);
    if (!files.length) return json("At least one document file is required.", 400);

    const documentId = crypto.randomUUID();

    // Begin transaction equivalent
    const [result] = await prisma.$queryRaw`
      INSERT INTO library_documents (id, course_id, subject_id, doc_date, title, description, status, created_by, created_at, updated_at)
      VALUES (${documentId}::uuid, ${courseId}::uuid, ${subjectId}::uuid, ${new Date(docDate)}, ${title}, ${description || null}, 'active', ${session.user.id}::uuid, NOW(), NOW())
      RETURNING id::text AS id, title, doc_date
    `;

    for (const file of files) {
      const fileId = crypto.randomUUID();
      let fileType = 'other';
      const fileUrlLower = normalizeText(file.url).toLowerCase();
      
      if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(fileUrlLower)) fileType = 'image';
      else if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(fileUrlLower)) fileType = 'video';
      else if (fileUrlLower.includes('.pdf')) fileType = 'pdf';

      await prisma.$executeRaw`
        INSERT INTO library_document_files (id, library_document_id, file_url, file_type, original_name, created_at)
        VALUES (${fileId}::uuid, ${documentId}::uuid, ${file.url}, ${fileType}, ${file.originalName || null}, NOW())
      `;
    }

    return json("Library document created successfully.", 201, {
      item: result
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to create library document.", 500);
  }
}

export async function PATCH(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    
    const id = normalizeText(body?.id);
    const courseId = normalizeText(body?.courseId);
    const subjectId = normalizeText(body?.subjectId);
    const docDate = normalizeText(body?.docDate);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const files = Array.isArray(body?.files) ? body.files : []; // Array of new files (if any)
    const existingFileIds = Array.isArray(body?.existingFileIds) ? body.existingFileIds : []; // Files to keep

    if (!id) return json("Document ID is required.", 400);
    if (!courseId) return json("Class/Course is required.", 400);
    if (!subjectId) return json("Subject is required.", 400);
    if (!docDate) return json("Date is required.", 400);
    if (!title) return json("Title is required.", 400);
    if (files.length === 0 && existingFileIds.length === 0) return json("At least one document file is required.", 400);

    // Update main document
    await prisma.$executeRaw`
      UPDATE library_documents
      SET
        course_id = ${courseId}::uuid,
        subject_id = ${subjectId}::uuid,
        doc_date = ${new Date(docDate)},
        title = ${title},
        description = ${description || null},
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    // Remove deleted files
    if (existingFileIds.length > 0) {
      const ids = Prisma.join(existingFileIds.map(fid => Prisma.sql`${fid}::uuid`));
      await prisma.$executeRaw`
        DELETE FROM library_document_files
        WHERE library_document_id = ${id}::uuid AND id NOT IN (${ids})
      `;
    } else {
       await prisma.$executeRaw`
        DELETE FROM library_document_files
        WHERE library_document_id = ${id}::uuid
      `;
    }

    // Add new files
    for (const file of files) {
      const fileId = crypto.randomUUID();
      let fileType = 'other';
      const fileUrlLower = normalizeText(file.url).toLowerCase();
      
      if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(fileUrlLower)) fileType = 'image';
      else if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(fileUrlLower)) fileType = 'video';
      else if (fileUrlLower.includes('.pdf')) fileType = 'pdf';

      await prisma.$executeRaw`
        INSERT INTO library_document_files (id, library_document_id, file_url, file_type, original_name, created_at)
        VALUES (${fileId}::uuid, ${id}::uuid, ${file.url}, ${fileType}, ${file.originalName || null}, NOW())
      `;
    }

    return json("Library document updated successfully.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to update library document.", 500);
  }
}

export async function DELETE(request) {
  try {
    await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const id = normalizeText(body?.id);

    if (!id) return json("Document ID is required.", 400);

    await prisma.$executeRaw`
      UPDATE library_documents
      SET status = 'archived', updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return json("Library document archived successfully.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to archive library document.", 500);
  }
}
