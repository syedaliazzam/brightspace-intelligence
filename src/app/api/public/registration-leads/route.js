import { NextResponse } from "next/server";
import { normalizeClassLevel } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";

function json(success, message, status) {
  return NextResponse.json({ success, message }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const studentName = normalizeText(body?.student_name);
    const parentName = normalizeText(body?.parent_name);
    const parentRelation = normalizeText(body?.parent_relation);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const age = Number(normalizeText(body?.age));
    const classLevel = normalizeClassLevel(body?.class_level);
    const address = normalizeText(body?.address);
    const city = normalizeText(body?.city);
    const notes = normalizeText(body?.notes);
    const leadToken = normalizeText(body?.leadToken);

    if (!studentName) return json(false, "Student name is required.", 400);
    if (!parentName) return json(false, "Parent name is required.", 400);
    if (!parentRelation) return json(false, "Parent relation is required.", 400);
    if (!email || !isValidEmail(email)) return json(false, "A valid parent email is required.", 400);
    if (!phone) return json(false, "Phone is required.", 400);
    if (!Number.isFinite(age) || age <= 0) return json(false, "Student age must be a valid number.", 400);
    if (!classLevel) return json(false, "Class level is required.", 400);

    if (leadToken) {
      const [linkedLead] = await prisma.$queryRaw`
        SELECT
          id::text AS id,
          status::text AS status,
          registration_lead_id::text AS registration_lead_id
        FROM interested_students
        WHERE registration_token = ${leadToken}
        LIMIT 1
      `;

      if (linkedLead?.status === "registered" && linkedLead?.registration_lead_id) {
        return json(true, "Registration already completed.", 200);
      }
    }

    const [createdLead] = await prisma.$queryRaw`
      INSERT INTO registration_leads (
        student_name,
        parent_name,
        parent_relation,
        email,
        phone,
        age,
        class_level,
        address,
        city,
        notes,
        source,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${studentName},
        ${parentName},
        ${parentRelation},
        ${email},
        ${phone},
        ${age},
        ${classLevel},
        ${address || null},
        ${city || null},
        ${notes || null},
        ${"website_registration"},
        CAST(${ "new_lead" } AS registration_status),
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

    if (leadToken && createdLead?.id) {
      await prisma.$executeRaw`
        UPDATE interested_students
        SET
          status = 'registered',
          registration_lead_id = ${createdLead.id}::uuid,
          updated_at = NOW()
        WHERE registration_token = ${leadToken}
      `;
    }

    return json(true, "Registration submitted successfully. Our coordinator will contact you soon.", 201);
  } catch (error) {
    return json(false, error instanceof Error ? error.message : "Unable to submit registration.", 500);
  }
}
