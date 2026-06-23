import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function json(success, message, status = 200, extra = {}) {
  return NextResponse.json({ success, message, ...extra }, { status });
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
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);

    if (!studentName) return json(false, "Student name is required.", 400);
    if (!parentName) return json(false, "Parent name is required.", 400);
    if (!email || !isValidEmail(email)) return json(false, "A valid email is required.", 400);
    if (!phone) return json(false, "Phone number is required.", 400);

    await prisma.$executeRaw`
      INSERT INTO interested_students (
        id,
        student_name,
        parent_name,
        email,
        phone,
        source,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${crypto.randomUUID()}::uuid,
        ${studentName},
        ${parentName},
        ${email},
        ${phone},
        ${"contact_us"},
        ${"new"},
        NOW(),
        NOW()
      )
    `;

    return json(true, "Thank you. Our coordinator will contact you soon.", 201);
  } catch (error) {
    return json(false, error instanceof Error ? error.message : "Unable to submit contact request.", 500);
  }
}
