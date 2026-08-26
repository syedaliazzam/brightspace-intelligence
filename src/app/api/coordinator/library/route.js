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

function normalizeIdList(value, fallback = []) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => normalizeText(item)).filter(Boolean))];
  }
  const singleValue = normalizeText(value);
  return singleValue ? [singleValue] : fallback;
}

async function getTableColumns(tableName) {
  const rows = await prisma.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return new Set(rows.map((row) => String(row.column_name || "").toLowerCase()));
}

export async function GET(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES_GET);
    const { searchParams } = new URL(request.url);
    const portalType = (searchParams.get("portalType") || "").toLowerCase();
    const childId = normalizeText(searchParams.get("childId"));
    const columns = await getTableColumns("library_documents");
    const hasCourseIds = columns.has("course_ids");
    const hasSubjectIds = columns.has("subject_ids");
    const courseIdsExpression = hasCourseIds ? "COALESCE(ld.course_ids, jsonb_build_array(ld.course_id))" : "jsonb_build_array(ld.course_id)";
    const subjectIdsExpression = hasSubjectIds ? "COALESCE(ld.subject_ids, jsonb_build_array(ld.subject_id))" : "jsonb_build_array(ld.subject_id)";
    
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
        ${courseIdsExpression} AS course_ids,
        ${subjectIdsExpression} AS subject_ids,
        ld.doc_date,
        ld.title,
        ld.description,
        ld.status,
        ld.created_by::text AS created_by,
        ld.created_at,
        c.title AS course_title,
        c.class_level AS class_level,
        s.name AS subject_name,
        COALESCE((
          SELECT STRING_AGG(DISTINCT COALESCE(NULLIF(c_multi.class_level, ''), c_multi.title), ', ' ORDER BY COALESCE(NULLIF(c_multi.class_level, ''), c_multi.title))
          FROM courses c_multi
          WHERE c_multi.id::text IN (SELECT jsonb_array_elements_text(${courseIdsExpression}))
        ), COALESCE(NULLIF(c.class_level, ''), c.title)) AS course_titles,
        COALESCE((
          SELECT STRING_AGG(DISTINCT s_multi.name, ', ' ORDER BY s_multi.name)
          FROM subjects s_multi
          WHERE s_multi.id::text IN (SELECT jsonb_array_elements_text(${subjectIdsExpression}))
        ), s.name) AS subject_names,
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
            AND ta.status::text = 'active'
            AND ta.course_id::text IN (SELECT jsonb_array_elements_text(${courseIdsExpression}))
            AND ta.subject_id::text IN (SELECT jsonb_array_elements_text(${subjectIdsExpression}))
        )
      `;
    } else if (role === 'parent') {
      values.push(session.user.id);
      const childParamIndex = values.length + 1;
      if (childId) values.push(childId);
      queryStr += `
        AND EXISTS (
          SELECT 1 FROM enrollments e
          JOIN student_parents p ON p.student_id = e.student_id
          JOIN student_profiles sp ON sp.id = e.student_id
          JOIN parent_profiles pp ON pp.id = p.parent_id
          WHERE pp.user_id = $2::uuid
            ${childId ? `AND e.student_id = $${childParamIndex}::uuid` : ""}
            AND LOWER(COALESCE(e.status::text, 'active')) = 'active'
            AND LOWER(COALESCE(sp.status::text, 'active')) = 'active'
            AND e.course_id::text IN (SELECT jsonb_array_elements_text(${courseIdsExpression}))
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
    const courseIds = normalizeIdList(body?.courseIds, courseId ? [courseId] : []);
    const subjectIds = normalizeIdList(body?.subjectIds, subjectId ? [subjectId] : []);
    const docDate = normalizeText(body?.docDate);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const files = Array.isArray(body?.files) ? body.files : [];

    if (!courseIds.length) return json("At least one class/course is required.", 400);
    if (!subjectIds.length) return json("At least one subject is required.", 400);
    if (!docDate) return json("Date is required.", 400);
    if (!title) return json("Title is required.", 400);
    if (!files.length) return json("At least one document file is required.", 400);

    const documentId = crypto.randomUUID();
    const columns = await getTableColumns("library_documents");
    const courseIdsColumn = columns.has("course_ids") ? Prisma.sql`, course_ids` : Prisma.empty;
    const courseIdsValue = columns.has("course_ids") ? Prisma.sql`, ${JSON.stringify(courseIds)}::jsonb` : Prisma.empty;
    const subjectIdsColumn = columns.has("subject_ids") ? Prisma.sql`, subject_ids` : Prisma.empty;
    const subjectIdsValue = columns.has("subject_ids") ? Prisma.sql`, ${JSON.stringify(subjectIds)}::jsonb` : Prisma.empty;

    // Begin transaction equivalent
    const [result] = await prisma.$queryRaw`
      INSERT INTO library_documents (id, course_id, subject_id${courseIdsColumn}${subjectIdsColumn}, doc_date, title, description, status, created_by, created_at, updated_at)
      VALUES (${documentId}::uuid, ${courseIds[0]}::uuid, ${subjectIds[0]}::uuid${courseIdsValue}${subjectIdsValue}, ${new Date(docDate)}, ${title}, ${description || null}, 'active', ${session.user.id}::uuid, NOW(), NOW())
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
    const courseIds = normalizeIdList(body?.courseIds, courseId ? [courseId] : []);
    const subjectIds = normalizeIdList(body?.subjectIds, subjectId ? [subjectId] : []);
    const docDate = normalizeText(body?.docDate);
    const title = normalizeText(body?.title);
    const description = normalizeText(body?.description);
    const files = Array.isArray(body?.files) ? body.files : []; // Array of new files (if any)
    const existingFileIds = Array.isArray(body?.existingFileIds) ? body.existingFileIds : []; // Files to keep

    if (!id) return json("Document ID is required.", 400);
    if (!courseIds.length) return json("At least one class/course is required.", 400);
    if (!subjectIds.length) return json("At least one subject is required.", 400);
    if (!docDate) return json("Date is required.", 400);
    if (!title) return json("Title is required.", 400);
    if (files.length === 0 && existingFileIds.length === 0) return json("At least one document file is required.", 400);

    // Update main document
    const columns = await getTableColumns("library_documents");
    const courseIdsUpdate = columns.has("course_ids") ? Prisma.sql`, course_ids = ${JSON.stringify(courseIds)}::jsonb` : Prisma.empty;
    const subjectIdsUpdate = columns.has("subject_ids") ? Prisma.sql`, subject_ids = ${JSON.stringify(subjectIds)}::jsonb` : Prisma.empty;
    await prisma.$executeRaw`
      UPDATE library_documents
      SET
        course_id = ${courseIds[0]}::uuid,
        subject_id = ${subjectIds[0]}::uuid,
        doc_date = ${new Date(docDate)},
        title = ${title},
        description = ${description || null},
        updated_at = NOW()
        ${courseIdsUpdate}
        ${subjectIdsUpdate}
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
