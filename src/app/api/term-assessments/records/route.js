import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse, normalizeRole } from "@/lib/roleGuard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_ROLES = ["coordinator", "admin", "superadmin"];
const WRITE_ROLES = ["coordinator", "superadmin"];
const ALL_ROLES = [...MANAGE_ROLES, "teacher", "parent", "student"];

let recordsTableEnsured = false;
async function ensureTables() {
  if (recordsTableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS term_student_assessments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID,
        assessment_name VARCHAR(255),
        student_id UUID NOT NULL,
        course_id UUID,
        class_name VARCHAR(100) NOT NULL,
        term VARCHAR(100) DEFAULT 'Term 1',
        academic_year VARCHAR(50) DEFAULT '2025-2026',
        status VARCHAR(50) DEFAULT 'PUBLISHED',
        teacher_remarks TEXT,
        records JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE term_student_assessments ADD COLUMN IF NOT EXISTS assessment_name VARCHAR(255)
    `);
    recordsTableEnsured = true;
  } catch {
    recordsTableEnsured = true;
  }
}

// Helper to compute summaries for pizza pie charts (normalized to 0-100% scale)
function enrichRecordsWithSummary(records = []) {
  if (!Array.isArray(records)) return [];
  return records.map((area) => {
    const rawSkills = Array.isArray(area.skills) ? area.skills : [];
    let achievedCount = 0;
    let developingCount = 0;
    let otherCount = 0;
    let totalScore = 0;

      const skills = rawSkills.map((s) => {
        const obs = String(s.observation || "").trim().toLowerCase();
        let score = Number(s.score);
        if (isNaN(score)) score = 100;
        // Convert legacy 0.0 - 1.0 decimals to 0 - 100%
        if (score > 0 && score <= 1) {
          score = Math.round(score * 100);
        }
        totalScore += score;

        if (obs.includes("achieve")) {
          achievedCount++;
        } else if (obs.includes("develop")) {
          developingCount++;
        } else {
          otherCount++;
        }

        return {
          ...s,
          score,
        };
      });

      const total = skills.length;
      const avgScore = total > 0 ? Number((totalScore / total).toFixed(1)) : 0;

      return {
        ...area,
        skills,
        summary: {
          achieved: achievedCount,
          developing: developingCount,
          other: otherCount,
          total,
          average_score: avgScore,
        },
      };
    });
  }

export async function GET(request) {
    try {
      const session = await requireRole(ALL_ROLES);
      const role = normalizeRole(session.user.role);
      const userId = session.user.id;
      const { searchParams } = new URL(request.url);
      const requestedStudentId = searchParams.get("student_id");
      const requestedClass = searchParams.get("class_name");

      await ensureTables();

      let assessments = [];
      let students = [];
      let classes = [];

      // 1. Coordinator, Admin, SuperAdmin
      if (MANAGE_ROLES.includes(role)) {
        try {
          assessments = await prisma.$queryRaw`
          SELECT
            a.id::text AS id,
            a.template_id::text AS template_id,
            a.student_id::text AS student_id,
            a.course_id::text AS course_id,
            a.class_name,
            a.term,
            a.academic_year,
            a.status,
            a.teacher_remarks,
            a.records,
            a.created_at,
            a.updated_at,
            u.full_name AS student_name,
            sp.admission_no,
            COALESCE(pu.full_name, rl.parent_name) AS father_name,
            COALESCE(NULLIF(rl.child_photograph_file_path, ''), '') AS profile_picture_path,
            COALESCE(NULLIF(a.assessment_name, ''), t.name, 'Custom Assessment') AS template_name
          FROM term_student_assessments a
          INNER JOIN student_profiles sp ON sp.id = a.student_id
          INNER JOIN users u ON u.id = sp.user_id
          LEFT JOIN term_assessment_templates t ON t.id = a.template_id
          LEFT JOIN enrollments e ON e.student_id = sp.id
          LEFT JOIN registration_leads rl ON rl.id = e.registration_id
          LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
          LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
          LEFT JOIN users pu ON pu.id = pp.user_id
          ORDER BY a.updated_at DESC
        `;
        } catch (err) {
          console.warn("Could not query term_student_assessments:", err.message);
          assessments = [];
        }

        // Fetch students list for dropdown
        try {
          students = await prisma.$queryRaw`
          SELECT DISTINCT
            sp.id::text AS id,
            u.full_name AS student_name,
            sp.admission_no,
            COALESCE(NULLIF(c.class_level, ''), c.title, sp.grade_level, 'PlayGroup') AS class_name,
            COALESCE(pu.full_name, rl.parent_name) AS father_name
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
        } catch {
          students = [];
        }

        // Fetch classes
        try {
          const classRows = await prisma.$queryRaw`
          SELECT DISTINCT
            COALESCE(NULLIF(class_level, ''), title) AS title
          FROM courses
          WHERE COALESCE(status, 'active'::user_status) = 'active'::user_status
          ORDER BY title ASC
        `;
          classes = classRows.map((r) => r.title).filter(Boolean);
        } catch {
          classes = [];
        }
      }

      // 2. Parent Role
      else if (role === "parent") {
        try {
          assessments = await prisma.$queryRaw`
          SELECT
            a.id::text AS id,
            a.template_id::text AS template_id,
            a.student_id::text AS student_id,
            a.course_id::text AS course_id,
            a.class_name,
            a.term,
            a.academic_year,
            a.status,
            a.teacher_remarks,
            a.records,
            a.created_at,
            a.updated_at,
            u.full_name AS student_name,
            sp.admission_no,
            COALESCE(pu.full_name, rl.parent_name) AS father_name,
            COALESCE(NULLIF(rl.child_photograph_file_path, ''), '') AS profile_picture_path,
            COALESCE(NULLIF(a.assessment_name, ''), t.name, 'Custom Assessment') AS template_name
          FROM term_student_assessments a
          INNER JOIN student_profiles sp ON sp.id = a.student_id
          INNER JOIN users u ON u.id = sp.user_id
          INNER JOIN student_parents spp ON spp.student_id = sp.id
          INNER JOIN parent_profiles pp ON pp.id = spp.parent_id
          LEFT JOIN term_assessment_templates t ON t.id = a.template_id
          LEFT JOIN enrollments e ON e.student_id = sp.id
          LEFT JOIN registration_leads rl ON rl.id = e.registration_id
          LEFT JOIN users pu ON pu.id = pp.user_id
          WHERE pp.user_id = ${userId}::uuid
            AND LOWER(a.status) = 'published'
          ORDER BY a.updated_at DESC
        `;
        } catch (err) {
          console.warn("Parent term assessments query error:", err.message);
          assessments = [];
        }
      }

      // 3. Student Role
      else if (role === "student") {
        try {
          assessments = await prisma.$queryRaw`
          SELECT
            a.id::text AS id,
            a.template_id::text AS template_id,
            a.student_id::text AS student_id,
            a.course_id::text AS course_id,
            a.class_name,
            a.term,
            a.academic_year,
            a.status,
            a.teacher_remarks,
            a.records,
            a.created_at,
            a.updated_at,
            u.full_name AS student_name,
            sp.admission_no,
            COALESCE(pu.full_name, rl.parent_name) AS father_name,
            COALESCE(NULLIF(rl.child_photograph_file_path, ''), '') AS profile_picture_path,
            COALESCE(NULLIF(a.assessment_name, ''), t.name, 'Custom Assessment') AS template_name
          FROM term_student_assessments a
          INNER JOIN student_profiles sp ON sp.id = a.student_id
          INNER JOIN users u ON u.id = sp.user_id
          LEFT JOIN term_assessment_templates t ON t.id = a.template_id
          LEFT JOIN enrollments e ON e.student_id = sp.id
          LEFT JOIN registration_leads rl ON rl.id = e.registration_id
          LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
          LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
          LEFT JOIN users pu ON pu.id = pp.user_id
          WHERE (sp.user_id = ${userId}::uuid OR a.student_id = ${userId}::uuid)
            AND LOWER(a.status) = 'published'
          ORDER BY a.updated_at DESC
        `;
        } catch (err) {
          console.warn("Student term assessments query error:", err.message);
          assessments = [];
        }
      }

      // Deduplicate assessments by ID if joins produced multiple rows
      const uniqueAssessments = [];
      const seenIds = new Set();
      for (const item of assessments) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          uniqueAssessments.push(item);
        }
      }

      // Deduplicate students by ID
      const uniqueStudents = [];
      const seenStudentIds = new Set();
      for (const st of students) {
        if (st?.id && !seenStudentIds.has(st.id)) {
          seenStudentIds.add(st.id);
          uniqueStudents.push(st);
        }
      }

      return NextResponse.json({
        assessments: uniqueAssessments,
        students: uniqueStudents,
        classes,
      });
    } catch (err) {
      const guarded = roleGuardResponse(err);
      if (guarded) return guarded;
      console.error("GET /api/term-assessments/records error:", err);
      return NextResponse.json({ message: err.message || "Failed to fetch assessments" }, { status: 500 });
    }
  }

  export async function POST(request) {
    try {
      const session = await requireRole(WRITE_ROLES);
      const body = await request.json();
      const {
        template_id,
        assessment_name,
        student_id,
        course_id,
        class_name,
        term = "Term 1",
        academic_year = "2025-2026",
        status = "PUBLISHED",
        teacher_remarks = "",
        records = [],
      } = body;

      if (!student_id) {
        return NextResponse.json({ message: "Student is required." }, { status: 400 });
      }
      if (!class_name) {
        return NextResponse.json({ message: "Class name is required." }, { status: 400 });
      }

      await ensureTables();

      const enrichedRecords = enrichRecordsWithSummary(records);
      const userId = session.user.id;

      const [created] = await prisma.$queryRaw`
      INSERT INTO term_student_assessments (
        template_id,
        assessment_name,
        student_id,
        course_id,
        class_name,
        term,
        academic_year,
        status,
        teacher_remarks,
        records,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${template_id || null}::uuid,
        ${assessment_name || null},
        ${student_id}::uuid,
        ${course_id || null}::uuid,
        ${class_name.trim()},
        ${term || "Term 1"},
        ${academic_year || "2025-2026"},
        ${status || "PUBLISHED"},
        ${teacher_remarks || null},
        ${JSON.stringify(enrichedRecords)}::jsonb,
        ${userId}::uuid,
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

      return NextResponse.json({
        message: "Student assessment saved successfully.",
        id: created?.id,
      }, { status: 201 });
    } catch (err) {
      const guarded = roleGuardResponse(err);
      if (guarded) return guarded;
      console.error("POST /api/term-assessments/records error:", err);
      return NextResponse.json({ message: err.message || "Failed to save assessment" }, { status: 500 });
    }
  }

  export async function PUT(request) {
    try {
      const session = await requireRole(WRITE_ROLES);
      const body = await request.json();
      const {
        id,
        template_id,
        assessment_name,
        student_id,
        course_id,
        class_name,
        term = "Term 1",
        academic_year = "2025-2026",
        status = "PUBLISHED",
        teacher_remarks = "",
        records = [],
      } = body;

      if (!id) {
        return NextResponse.json({ message: "Assessment ID is required." }, { status: 400 });
      }

      const enrichedRecords = enrichRecordsWithSummary(records);

      await prisma.$executeRaw`
      UPDATE term_student_assessments
      SET
        template_id = ${template_id || null}::uuid,
        assessment_name = COALESCE(${assessment_name || null}, assessment_name),
        student_id = COALESCE(${student_id || null}::uuid, student_id),
        course_id = ${course_id || null}::uuid,
        class_name = ${class_name ? class_name.trim() : null},
        term = ${term || "Term 1"},
        academic_year = ${academic_year || "2025-2026"},
        status = ${status || "PUBLISHED"},
        teacher_remarks = ${teacher_remarks || null},
        records = ${JSON.stringify(enrichedRecords)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

      return NextResponse.json({ message: "Student assessment updated successfully." });
    } catch (err) {
      const guarded = roleGuardResponse(err);
      if (guarded) return guarded;
      console.error("PUT /api/term-assessments/records error:", err);
      return NextResponse.json({ message: err.message || "Failed to update assessment" }, { status: 500 });
    }
  }

  export async function DELETE(request) {
    try {
      const session = await requireRole(WRITE_ROLES);
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");

      if (!id) {
        return NextResponse.json({ message: "Assessment ID is required." }, { status: 400 });
      }

      await prisma.$executeRaw`
      DELETE FROM term_student_assessments WHERE id = ${id}::uuid
    `;

      return NextResponse.json({ message: "Assessment deleted successfully." });
    } catch (err) {
      const guarded = roleGuardResponse(err);
      if (guarded) return guarded;
      console.error("DELETE /api/term-assessments/records error:", err);
      return NextResponse.json({ message: err.message || "Failed to delete assessment" }, { status: 500 });
    }
  }

