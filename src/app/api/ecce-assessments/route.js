import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { ECCE_SECTIONS, ECCE_SUBJECTS, ECCE_TERMS } from "@/lib/ecceAssessmentTemplate";
import { createSignedAdmissionDocumentUrl } from "@/lib/supabaseStorage";

// ECCE Assessments API Handler
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_ROLES = ["coordinator", "admin", "superadmin"];
const ALL_ROLES = [...MANAGE_ROLES, "teacher", "parent", "student"];
const LOCKED_STATUSES = new Set(["APPROVED", "PUBLISHED", "ARCHIVED"]);

const ECCE_CACHE_TTL_MS = 60 * 1000; // 60s cache
const ecceServerCache = new Map();

export function clearEcceCache() {
  ecceServerCache.clear();
}

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value) {
  return String(value || "").toLowerCase();
}

function dedupeStudents(rows = []) {
  const seen = new Map();
  for (const row of rows || []) {
    const id = String(row?.id || "").trim();
    if (!id) continue;
    if (!seen.has(id)) {
      seen.set(id, row);
      continue;
    }
    const existing = seen.get(id);
    seen.set(id, {
      ...existing,
      class_name: existing.class_name || row.class_name,
      course_id: existing.course_id || row.course_id,
      father_name: existing.father_name || row.father_name,
      age: existing.age || row.age,
      admission_no: existing.admission_no || row.admission_no,
      profile_picture_path: existing.profile_picture_path || row.profile_picture_path,
      date_of_birth: existing.date_of_birth || row.date_of_birth,
    });
  }
  return Array.from(seen.values());
}

function templatePayload() {
  return {
    sections: ECCE_SECTIONS,
    subjects: ECCE_SUBJECTS,
    terms: ECCE_TERMS,
    criteriaCount: ECCE_SECTIONS.reduce((sum, section) => sum + section.criteria.length, 0),
  };
}

async function getTeacherId(userId) {
  const [teacher] = await prisma.$queryRaw`
    SELECT id::text AS id FROM teacher_profiles WHERE user_id = ${userId}::uuid LIMIT 1
  `;
  return teacher?.id || null;
}

async function getStudentId(userId) {
  const [student] = await prisma.$queryRaw`
    SELECT id::text AS id FROM student_profiles WHERE user_id = ${userId}::uuid LIMIT 1
  `;
  return student?.id || null;
}

async function getAccessibleStudents(session) {
  const role = normalizeRole(session.user.role);

  if (MANAGE_ROLES.includes(role) || role === "teacher") {
    return prisma.$queryRaw`
      SELECT DISTINCT
        sp.id::text AS id,
        sp.user_id::text AS user_id,
        u.full_name AS student_name,
        sp.admission_no,
        COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age,
        COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
        c.id::text AS course_id,
        NULL::text AS subject_id,
        NULL::text AS subject_name,
        rl.child_photograph_file_path AS profile_picture_path,
        COALESCE(pu.full_name, rl.parent_name) AS father_name,
        rl.date_of_birth
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status::text) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      ORDER BY u.full_name ASC
    `;
  }

  if (role === "parent") {
    return prisma.$queryRaw`
      SELECT DISTINCT
        sp.id::text AS id,
        sp.user_id::text AS user_id,
        u.full_name AS student_name,
        sp.admission_no,
        COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age,
        COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
        c.id::text AS course_id,
        NULL::text AS subject_id,
        NULL::text AS subject_name,
        rl.child_photograph_file_path AS profile_picture_path,
        COALESCE(pu.full_name, rl.parent_name) AS father_name,
        rl.date_of_birth,
        spp.is_primary
      FROM parent_profiles pp
      INNER JOIN student_parents spp ON spp.parent_id = pp.id
      INNER JOIN student_profiles sp ON sp.id = spp.student_id
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status::text) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE pp.user_id = ${session.user.id}::uuid
      ORDER BY spp.is_primary DESC, u.full_name ASC
    `;
  }

  if (role === "student") {
    return prisma.$queryRaw`
      SELECT DISTINCT
        sp.id::text AS id,
        sp.user_id::text AS user_id,
        u.full_name AS student_name,
        sp.admission_no,
        COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age,
        COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
        c.id::text AS course_id,
        NULL::text AS subject_id,
        NULL::text AS subject_name,
        rl.child_photograph_file_path AS profile_picture_path,
        COALESCE(pu.full_name, rl.parent_name) AS father_name,
        rl.date_of_birth
      FROM student_profiles sp
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN enrollments e ON e.student_id = sp.id AND LOWER(e.status::text) = 'active'
      LEFT JOIN courses c ON c.id = e.course_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE sp.user_id = ${session.user.id}::uuid
      LIMIT 1
    `;
  }

  return [];
}

async function getClassOptions() {
  return prisma.$queryRaw`
    SELECT DISTINCT
      id::text AS id,
      COALESCE(NULLIF(class_level, ''), title) AS title
    FROM courses
    WHERE COALESCE(status, 'active'::user_status) = 'active'::user_status
    ORDER BY COALESCE(NULLIF(class_level, ''), title) ASC
  `;
}

async function getAssessments(session, accessibleStudents) {
  const role = normalizeRole(session.user.role);
  const ids = accessibleStudents.map((student) => student.id).filter(Boolean);

  if (MANAGE_ROLES.includes(role)) {
    return prisma.$queryRaw`
      SELECT
        a.id::text AS id,
        a.student_id::text AS student_id,
        sp.user_id::text AS student_user_id,
        a.teacher_id::text AS teacher_id,
        a.course_id::text AS course_id,
        a.academic_year,
        a.term,
        a.status,
        a.responses,
        a.subject_performance,
        a.teacher_remarks,
        a.coordinator_comments,
        a.returned_reason,
        a.submitted_at,
        a.approved_at,
        a.published_at,
        a.created_at,
        a.updated_at,
        su.full_name AS student_name,
        tu.full_name AS teacher_name,
        COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
        COALESCE(NULLIF(rl.child_photograph_file_path, ''), (a.responses->'__studentInfo'->>'picturePath')) AS profile_picture_path,
        COALESCE(pu.full_name, rl.parent_name) AS father_name,
        rl.date_of_birth,
        sp.admission_no,
        COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age
      FROM ecce_student_assessments a
      INNER JOIN student_profiles sp ON sp.id = a.student_id
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN teacher_profiles tp ON tp.id = a.teacher_id
      LEFT JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN courses c ON c.id = a.course_id
      LEFT JOIN enrollments e ON e.student_id = sp.id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      ORDER BY a.updated_at DESC
    `;
  }

  if (role === "teacher") {
    if (ids.length > 0) {
      return prisma.$queryRawUnsafe(
        `
        SELECT
          a.id::text AS id,
          a.student_id::text AS student_id,
          sp.user_id::text AS student_user_id,
          a.teacher_id::text AS teacher_id,
          a.course_id::text AS course_id,
          a.academic_year,
          a.term,
          a.status,
          a.responses,
          a.subject_performance,
          a.teacher_remarks,
          a.coordinator_comments,
          a.returned_reason,
          a.submitted_at,
          a.approved_at,
          a.published_at,
          a.created_at,
          a.updated_at,
          su.full_name AS student_name,
          tu.full_name AS teacher_name,
          COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
          COALESCE(NULLIF(rl.child_photograph_file_path, ''), (a.responses->'__studentInfo'->>'picturePath')) AS profile_picture_path,
          COALESCE(pu.full_name, rl.parent_name) AS father_name,
          rl.date_of_birth,
          sp.admission_no,
          COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age
        FROM ecce_student_assessments a
        INNER JOIN student_profiles sp ON sp.id = a.student_id
        INNER JOIN users su ON su.id = sp.user_id
        LEFT JOIN teacher_profiles tp ON tp.id = a.teacher_id
        LEFT JOIN users tu ON tu.id = tp.user_id
        LEFT JOIN courses c ON c.id = a.course_id
        LEFT JOIN enrollments e ON e.student_id = sp.id
        LEFT JOIN registration_leads rl ON rl.id = e.registration_id
        LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
        LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
        LEFT JOIN users pu ON pu.id = pp.user_id
        WHERE tp.user_id = $1::uuid OR a.student_id::text = ANY($2::text[])
        ORDER BY a.updated_at DESC
        `,
        session.user.id,
        ids
      );
    }
    return prisma.$queryRaw`
      SELECT
        a.id::text AS id,
        a.student_id::text AS student_id,
        sp.user_id::text AS student_user_id,
        a.teacher_id::text AS teacher_id,
        a.course_id::text AS course_id,
        a.academic_year,
        a.term,
        a.status,
        a.responses,
        a.subject_performance,
        a.teacher_remarks,
        a.coordinator_comments,
        a.returned_reason,
        a.submitted_at,
        a.approved_at,
        a.published_at,
        a.created_at,
        a.updated_at,
        su.full_name AS student_name,
        tu.full_name AS teacher_name,
        COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
        COALESCE(NULLIF(rl.child_photograph_file_path, ''), (a.responses->'__studentInfo'->>'picturePath')) AS profile_picture_path,
        COALESCE(pu.full_name, rl.parent_name) AS father_name,
        rl.date_of_birth,
        sp.admission_no,
        COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age
      FROM ecce_student_assessments a
      INNER JOIN student_profiles sp ON sp.id = a.student_id
      INNER JOIN users su ON su.id = sp.user_id
      LEFT JOIN teacher_profiles tp ON tp.id = a.teacher_id
      LEFT JOIN users tu ON tu.id = tp.user_id
      LEFT JOIN courses c ON c.id = a.course_id
      LEFT JOIN enrollments e ON e.student_id = sp.id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
      LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE tp.user_id = ${session.user.id}::uuid
      ORDER BY a.updated_at DESC
    `;
  }

  if (!ids.length) return [];
  return prisma.$queryRawUnsafe(
    `
    SELECT
      a.id::text AS id,
      a.student_id::text AS student_id,
      sp.user_id::text AS student_user_id,
      a.teacher_id::text AS teacher_id,
      a.course_id::text AS course_id,
      a.academic_year,
      a.term,
      a.status,
      a.responses,
      a.subject_performance,
      a.teacher_remarks,
      a.coordinator_comments,
      a.returned_reason,
      a.submitted_at,
      a.approved_at,
      a.published_at,
      a.created_at,
      a.updated_at,
      su.full_name AS student_name,
      tu.full_name AS teacher_name,
      COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level) AS class_name,
      COALESCE(NULLIF(rl.child_photograph_file_path, ''), (a.responses->'__studentInfo'->>'picturePath')) AS profile_picture_path,
      COALESCE(pu.full_name, rl.parent_name) AS father_name,
      rl.date_of_birth,
      sp.admission_no,
      COALESCE(NULLIF(CAST(sp.age AS text), ''), NULLIF(CAST(EXTRACT(YEAR FROM AGE(CURRENT_DATE, rl.date_of_birth)) AS text), '')) AS age
    FROM ecce_student_assessments a
    INNER JOIN student_profiles sp ON sp.id = a.student_id
    INNER JOIN users su ON su.id = sp.user_id
    LEFT JOIN teacher_profiles tp ON tp.id = a.teacher_id
    LEFT JOIN users tu ON tu.id = tp.user_id
    LEFT JOIN courses c ON c.id = a.course_id
    LEFT JOIN enrollments e ON e.student_id = sp.id
    LEFT JOIN registration_leads rl ON rl.id = e.registration_id
    LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
    LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
    LEFT JOIN users pu ON pu.id = pp.user_id
    WHERE a.student_id::text = ANY($1::text[])
      AND a.status = 'PUBLISHED'
    ORDER BY a.updated_at DESC
    `,
    ids
  );
}

async function getAttendanceSummary(studentUserIds) {
  if (!studentUserIds.length) return {};
  const rows = await prisma.$queryRawUnsafe(
    `
    SELECT
      sp.id::text AS student_id,
      COUNT(ls.id)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') IN ('present', 'partial'))::int AS present,
      COUNT(*) FILTER (WHERE COALESCE(la.status::text, 'absent') = 'absent' OR la.id IS NULL)::int AS absent
    FROM student_profiles sp
    INNER JOIN lecture_schedules ls ON ls.student_id = sp.id
    LEFT JOIN lecture_attendance la ON la.lecture_id = ls.id AND la.user_id = sp.user_id
    WHERE sp.user_id::text = ANY($1::text[])
      AND LOWER(ls.status::text) IN ('completed_by_teacher', 'verified_by_coordinator')
    GROUP BY sp.id
    `,
    studentUserIds
  );
  return Object.fromEntries((rows || []).map((row) => [row.student_id, row]));
}

function validateResponses(responses = {}) {
  const missing = [];
  for (const section of ECCE_SECTIONS) {
    for (const criterion of section.criteria) {
      const key = `${section.key}:${criterion.order}`;
      const row = responses?.[key] || {};
      if (!clean(row.mt) && !clean(row.ft)) missing.push(key);
    }
  }
  return missing;
}

async function canAccessStudent(session, studentId) {
  const role = normalizeRole(session.user.role);
  if (MANAGE_ROLES.includes(role)) return true;
  const students = dedupeStudents(await getAccessibleStudents(session));
  if (students.some((student) => String(student.id) === String(studentId))) return true;
  if (role === "teacher") {
    const [existing] = await prisma.$queryRaw`
      SELECT a.id::text AS id FROM ecce_student_assessments a
      INNER JOIN teacher_profiles tp ON tp.id = a.teacher_id
      WHERE tp.user_id = ${session.user.id}::uuid AND a.student_id = ${studentId}::uuid
      LIMIT 1
    `;
    if (existing) return true;
  }
  return false;
}

function extractStoragePath(value) {
  if (!value || typeof value !== "string") return "";
  let text = value.trim();
  if (!text || text.startsWith("data:") || text.startsWith("blob:")) return "";

  if (text.includes("/api/file-preview")) {
    try {
      const url = new URL(text, "http://localhost");
      const pathParam = url.searchParams.get("path");
      if (pathParam) text = pathParam;
    } catch {}
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const pathname = decodeURIComponent(url.pathname);
      const match = pathname.match(/\/storage\/v1\/object\/(?:sign|public|authenticated)\/(.+)$/);
      if (match && match[1]) {
        return match[1];
      }
      return "";
    } catch {
      return "";
    }
  }

  return text.replace(/^\/+/, "");
}

export async function GET() {
  try {
    const session = await requireRole(ALL_ROLES);
    const cacheKey = `${session.user.id}:${session.user.role}`;
    const cached = ecceServerCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return json("ECCE assessments fetched.", 200, cached.payload);
    }

    const rawStudents = dedupeStudents(await getAccessibleStudents(session));
    const [assessments, classes] = await Promise.all([
      getAssessments(session, rawStudents),
      getClassOptions(session),
    ]);
    const studentUserIds = Array.from(new Set([
      ...rawStudents.map((student) => student.user_id),
      ...(assessments || []).map((a) => a.student_user_id),
    ])).filter(Boolean);
    const attendance = await getAttendanceSummary(studentUserIds);

    const allPhotoPaths = new Set();
    const studentPhotoMap = new Map();

    // 1. Gather photo paths from all assessments (with safe JSON parsing and canonical path extraction)
    for (const a of (assessments || [])) {
      let resp = a.responses;
      if (typeof resp === "string") {
        try { resp = JSON.parse(resp); } catch { resp = {}; }
      }
      resp = resp && typeof resp === "object" ? resp : {};
      const sInfo = resp.__studentInfo && typeof resp.__studentInfo === "object" ? resp.__studentInfo : {};
      const rawPath = String(sInfo.picturePath || a.profile_picture_path || "").trim();
      const p = extractStoragePath(rawPath) || rawPath;
      if (p && !/^https?:\/\//i.test(p) && !p.startsWith("data:") && !p.startsWith("blob:")) {
        allPhotoPaths.add(p);
      }
      if (p && a.student_id && !studentPhotoMap.has(a.student_id)) {
        studentPhotoMap.set(a.student_id, p);
      }
    }

    // 2. Gather photo paths from rawStudents
    for (const s of rawStudents) {
      const rawPath = String(s.profile_picture_path || "").trim();
      const p = extractStoragePath(rawPath) || rawPath;
      if (p && !/^https?:\/\//i.test(p) && !p.startsWith("data:") && !p.startsWith("blob:")) {
        allPhotoPaths.add(p);
      }
      if (p && s.id && !studentPhotoMap.has(s.id)) {
        studentPhotoMap.set(s.id, p);
      }
    }

    // 3. Ensure any photo in studentPhotoMap is included in allPhotoPaths for signing
    for (const [, rawPath] of studentPhotoMap) {
      const p = extractStoragePath(rawPath) || rawPath;
      if (p && !/^https?:\/\//i.test(p) && !p.startsWith("data:") && !p.startsWith("blob:")) {
        allPhotoPaths.add(p);
      }
    }

    const signedUrlEntries = await Promise.all(
      Array.from(allPhotoPaths).map(async (path) => {
        const url = await createSignedAdmissionDocumentUrl(path).catch(() => "");
        return [path, url];
      })
    );
    const photoUrlMap = new Map(signedUrlEntries);

    function resolvePhotoUrl(path) {
      if (!path) return "";
      const cleanPath = extractStoragePath(path) || path;
      if (photoUrlMap.has(cleanPath)) {
        return photoUrlMap.get(cleanPath) || "";
      }
      if (/^https?:\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) return path;
      return "";
    }

    const students = rawStudents.map((student) => {
      const rawPhotoPath = student.profile_picture_path || studentPhotoMap.get(student.id) || "";
      const photoPath = extractStoragePath(rawPhotoPath) || rawPhotoPath;
      return {
        ...student,
        profile_picture_path: photoPath,
        profile_picture_url: resolvePhotoUrl(photoPath),
      };
    });

    const items = (assessments || []).map((item) => {
      const perf = Array.isArray(item.subject_performance)
        ? item.subject_performance.map((p) => ({ ...p, subject: p.subject === "دینی" ? "فہمِ دین" : p.subject }))
        : (typeof item.subject_performance === "string" ? JSON.parse(item.subject_performance || "[]") : item.subject_performance);

      let resp = item.responses;
      if (typeof resp === "string") {
        try { resp = JSON.parse(resp); } catch { resp = {}; }
      }
      resp = resp && typeof resp === "object" ? resp : {};
      const sInfo = resp.__studentInfo && typeof resp.__studentInfo === "object" ? resp.__studentInfo : {};
      const td = Number(sInfo.attendanceTd) || 0;
      const pd = Number(sInfo.attendancePd) || 0;
      const absent = Math.max(0, td - pd);
      const manualAttendance = td > 0 ? { total: td, present: pd, absent } : null;

      const rawPhotoPath = sInfo.picturePath || item.profile_picture_path || studentPhotoMap.get(item.student_id) || "";
      const photoPath = extractStoragePath(rawPhotoPath) || rawPhotoPath;

      return {
        ...item,
        responses: resp,
        subject_performance: perf,
        profile_picture_path: photoPath,
        profile_picture_url: resolvePhotoUrl(photoPath),
        attendance: manualAttendance || attendance[item.student_id] || { total: 0, present: 0, absent: 0 },
      };
    });

    const payload = { ...templatePayload(), students, items, classes };
    ecceServerCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + ECCE_CACHE_TTL_MS,
    });

    return json("ECCE assessments fetched.", 200, payload);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load ECCE assessments.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(["teacher", "admin", "superadmin"]);
    const body = await request.json();
    const studentId = clean(body?.studentId);
    const academicYear = clean(body?.academicYear) || String(new Date().getFullYear());
    const term = clean(body?.term);
    const responses = body?.responses && typeof body.responses === "object" ? body.responses : {};
    const rawSubjectPerformance = Array.isArray(body?.subjectPerformance) ? body.subjectPerformance : [];
    const subjectPerformance = rawSubjectPerformance.map((p) => ({ ...p, subject: p.subject === "دینی" ? "فہمِ دین" : p.subject }));
    const teacherRemarks = clean(body?.teacherRemarks);
    const courseId = clean(body?.courseId);

    if (!studentId || !term) return json("Student and term are required.", 400);
    if (!(await canAccessStudent(session, studentId))) return json("Student is not available for this role.", 403);
    const missing = validateResponses(responses);
    if (missing.length) return json("Please complete all mandatory assessment criteria before submitting.", 400, { missing });

    if (responses?.__studentInfo?.picturePath) {
      const rawPic = String(responses.__studentInfo.picturePath).trim();
      const cleanPic = extractStoragePath(rawPic);
      if (cleanPic) {
        responses.__studentInfo.picturePath = cleanPic;
      }
    }

    const role = normalizeRole(session.user.role);
    const teacherId = role === "teacher" ? await getTeacherId(session.user.id) : clean(body?.teacherId);

    const [existing] = await prisma.$queryRaw`
      SELECT id::text AS id, status FROM ecce_student_assessments
      WHERE student_id = ${studentId}::uuid AND academic_year = ${academicYear} AND term = ${term}
      LIMIT 1
    `;
    if (existing && LOCKED_STATUSES.has(String(existing.status))) {
      return json("This assessment is locked after approval.", 409);
    }

    const [saved] = existing
      ? await prisma.$queryRaw`
          UPDATE ecce_student_assessments
          SET responses = ${JSON.stringify(responses)}::jsonb,
              subject_performance = ${JSON.stringify(subjectPerformance)}::jsonb,
              teacher_remarks = ${teacherRemarks || null},
              teacher_id = COALESCE(${teacherId || null}::uuid, teacher_id),
              course_id = COALESCE(${courseId || null}::uuid, course_id),
              status = 'SUBMITTED',
              submitted_at = NOW(),
              returned_reason = NULL,
              updated_at = NOW()
          WHERE id = ${existing.id}::uuid
          RETURNING id::text AS id
        `
      : await prisma.$queryRaw`
          INSERT INTO ecce_student_assessments (
            student_id, teacher_id, course_id, academic_year, term, status,
            responses, subject_performance, teacher_remarks, submitted_at, created_at, updated_at
          )
          VALUES (
            ${studentId}::uuid, ${teacherId || null}::uuid, ${courseId || null}::uuid, ${academicYear}, ${term}, 'SUBMITTED',
            ${JSON.stringify(responses)}::jsonb, ${JSON.stringify(subjectPerformance)}::jsonb, ${teacherRemarks || null}, NOW(), NOW(), NOW()
          )
          RETURNING id::text AS id
        `;

    if (studentId && responses?.__studentInfo?.picturePath) {
      const pic = String(responses.__studentInfo.picturePath).trim();
      const cleanPic = extractStoragePath(pic) || pic;
      if (cleanPic && !cleanPic.startsWith("data:") && !cleanPic.startsWith("blob:")) {
        await prisma.$executeRaw`
          UPDATE registration_leads rl
          SET child_photograph_file_path = ${cleanPic}
          FROM enrollments e
          WHERE e.registration_id = rl.id AND e.student_id = ${studentId}::uuid
        `.catch(() => {});
      }
    }

    clearEcceCache();
    return json("Assessment submitted for coordinator review.", 200, { id: saved?.id });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to submit assessment.", 500);
  }
}

export async function PATCH(request) {
  try {
    const session = await requireRole(MANAGE_ROLES);
    const body = await request.json();
    const id = clean(body?.id);
    const action = clean(body?.action);
    const comments = clean(body?.comments);
    if (!id || !["approve", "publish", "correction"].includes(action)) return json("Valid action is required.", 400);

    if (action === "approve") {
      await prisma.$executeRaw`
        UPDATE ecce_student_assessments
        SET status = 'APPROVED',
            coordinator_comments = ${comments || null},
            approved_by = ${session.user.id}::uuid,
            approved_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}::uuid AND status IN ('SUBMITTED', 'COORDINATOR_REVIEW')
      `;
      clearEcceCache();
      return json("Assessment approved.", 200);
    }

    if (action === "publish") {
      await prisma.$executeRaw`
        UPDATE ecce_student_assessments
        SET status = 'PUBLISHED',
            coordinator_comments = ${comments || null},
            published_at = NOW(),
            updated_at = NOW()
        WHERE id = ${id}::uuid AND status = 'APPROVED'
      `;
      clearEcceCache();
      return json("Assessment published for parent and student portals.", 200);
    }

    await prisma.$executeRaw`
      UPDATE ecce_student_assessments
      SET status = 'CORRECTION_REQUIRED',
          returned_reason = ${comments || "Correction required."},
          updated_at = NOW()
      WHERE id = ${id}::uuid AND status IN ('SUBMITTED', 'COORDINATOR_REVIEW')
    `;
    clearEcceCache();
    return json("Assessment returned to teacher for correction.", 200);
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update assessment.", 500);
  }
}
