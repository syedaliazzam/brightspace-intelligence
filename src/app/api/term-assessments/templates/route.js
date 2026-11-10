import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MANAGE_ROLES = ["coordinator", "admin", "superadmin"];
const WRITE_ROLES = ["coordinator", "superadmin"];
const ALL_ROLES = [...MANAGE_ROLES, "teacher", "parent", "student"];

// Ensure table exists helper (graceful auto-create if permissions allow)
let templatesTableEnsured = false;
async function ensureTables() {
  if (templatesTableEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS term_assessment_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        course_id UUID,
        academic_year VARCHAR(50) DEFAULT '2025-2026',
        description TEXT,
        learning_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    templatesTableEnsured = true;
  } catch {
    templatesTableEnsured = true;
  }
}

export async function GET(request) {
  try {
    const session = await requireRole(ALL_ROLES);
    const { searchParams } = new URL(request.url);
    const className = searchParams.get("class_name");

    await ensureTables();

    let templates = [];
    try {
      if (className) {
        templates = await prisma.$queryRaw`
          SELECT 
            id::text AS id,
            name,
            class_name,
            course_id::text AS course_id,
            academic_year,
            description,
            learning_areas,
            created_at,
            updated_at
          FROM term_assessment_templates
          WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(${className}))
          ORDER BY updated_at DESC, created_at DESC
        `;
      } else {
        templates = await prisma.$queryRaw`
          SELECT 
            id::text AS id,
            name,
            class_name,
            course_id::text AS course_id,
            academic_year,
            description,
            learning_areas,
            created_at,
            updated_at
          FROM term_assessment_templates
          ORDER BY updated_at DESC, created_at DESC
        `;
      }
    } catch (dbErr) {
      console.warn("Could not query term_assessment_templates:", dbErr.message);
      return NextResponse.json({
        templates: [],
        classes: [],
        tableMissing: true,
        message: "Database table term_assessment_templates has not been created yet.",
      });
    }

    // Fetch active classes for dropdowns
    let classes = [];
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
      classes = ["PlayGroup", "Nursery", "Kindergarten", "Grade 1", "Grade 2", "Grade 3"];
    }

    if (!classes.length) {
      classes = ["PlayGroup", "Nursery", "Kindergarten", "Grade 1", "Grade 2"];
    }

    return NextResponse.json({
      templates,
      classes,
    });
  } catch (err) {
    const guarded = roleGuardResponse(err);
    if (guarded) return guarded;
    console.error("GET /api/term-assessments/templates error:", err);
    return NextResponse.json({ message: err.message || "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(WRITE_ROLES);
    const body = await request.json();
    const { name, class_name, academic_year, description, learning_areas } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ message: "Assessment Name is required." }, { status: 400 });
    }
    if (!class_name || !class_name.trim()) {
      return NextResponse.json({ message: "Class is required." }, { status: 400 });
    }

    await ensureTables();

    const cleanAreas = Array.isArray(learning_areas) ? learning_areas : [];
    const userId = session.user.id;

    const [created] = await prisma.$queryRaw`
      INSERT INTO term_assessment_templates (
        name,
        class_name,
        academic_year,
        description,
        learning_areas,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        ${name.trim()},
        ${class_name.trim()},
        ${academic_year || "2025-2026"},
        ${description || null},
        ${JSON.stringify(cleanAreas)}::jsonb,
        ${userId}::uuid,
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

    return NextResponse.json({
      message: "Assessment template created successfully.",
      templateId: created?.id,
    }, { status: 201 });
  } catch (err) {
    const guarded = roleGuardResponse(err);
    if (guarded) return guarded;
    console.error("POST /api/term-assessments/templates error:", err);
    return NextResponse.json({ message: err.message || "Failed to create template" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await requireRole(WRITE_ROLES);
    const body = await request.json();
    const { id, name, class_name, academic_year, description, learning_areas } = body;

    if (!id) {
      return NextResponse.json({ message: "Template ID is required." }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ message: "Assessment Name is required." }, { status: 400 });
    }
    if (!class_name || !class_name.trim()) {
      return NextResponse.json({ message: "Class is required." }, { status: 400 });
    }

    const cleanAreas = Array.isArray(learning_areas) ? learning_areas : [];

    await prisma.$executeRaw`
      UPDATE term_assessment_templates
      SET
        name = ${name.trim()},
        class_name = ${class_name.trim()},
        academic_year = ${academic_year || "2025-2026"},
        description = ${description || null},
        learning_areas = ${JSON.stringify(cleanAreas)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ message: "Assessment template updated successfully." });
  } catch (err) {
    const guarded = roleGuardResponse(err);
    if (guarded) return guarded;
    console.error("PUT /api/term-assessments/templates error:", err);
    return NextResponse.json({ message: err.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = await requireRole(WRITE_ROLES);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ message: "Template ID is required." }, { status: 400 });
    }

    await prisma.$executeRaw`
      DELETE FROM term_assessment_templates WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ message: "Assessment template deleted successfully." });
  } catch (err) {
    const guarded = roleGuardResponse(err);
    if (guarded) return guarded;
    console.error("DELETE /api/term-assessments/templates error:", err);
    return NextResponse.json({ message: err.message || "Failed to delete template" }, { status: 500 });
  }
}

