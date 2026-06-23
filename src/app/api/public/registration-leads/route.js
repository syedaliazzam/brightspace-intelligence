import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  buildRegistrationLeadPayload,
  normalizeText,
  upsertRegistrationLead,
} from "@/lib/registrationLeads";

function json(success, message, status) {
  return NextResponse.json({ success, message }, { status });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const studentName = normalizeText(body?.student_name ?? body?.studentName);
    const parentName = normalizeText(body?.parent_name ?? body?.parentName);
    const parentRelation = normalizeText(body?.parent_relation ?? body?.parentRelation);
    const email = normalizeText(body?.email ?? body?.parentEmail).toLowerCase();
    const phone = normalizeText(body?.phone);
    const studentAgeRaw = normalizeText(body?.student_age ?? body?.studentAge);
    const classLevel = normalizeText(body?.class_level ?? body?.classLevel);

    if (!studentName) {
      return json(false, "Student name is required.", 400);
    }

    if (!parentName) {
      return json(false, "Parent name is required.", 400);
    }

    if (!parentRelation) {
      return json(false, "Parent relation is required.", 400);
    }

    if (!email || !isValidEmail(email)) {
      return json(false, "A valid parent email is required.", 400);
    }

    if (!phone) {
      return json(false, "Phone is required.", 400);
    }

    if (!studentAgeRaw || Number.isNaN(Number(studentAgeRaw)) || Number(studentAgeRaw) <= 0) {
      return json(false, "Student age must be a valid number.", 400);
    }

    if (!classLevel) {
      return json(false, "Class level is required.", 400);
    }

    const lead = buildRegistrationLeadPayload({
      submission_id: crypto.randomUUID(),
      submitted_at: new Date().toISOString(),
      student_name: studentName,
      parent_name: parentName,
      parent_relation: parentRelation,
      email,
      phone,
      student_age: studentAgeRaw,
      class_level: classLevel,
      preferred_schedule: body?.preferred_schedule ?? body?.preferredSchedule,
      address: body?.address,
      city: body?.city,
      notes: body?.notes,
      source: "website_registration",
    });

    if (!lead.classLevel) {
      return json(false, "Please select a valid class level.", 400);
    }

    await upsertRegistrationLead(lead, prisma);

    return json(true, "Registration submitted successfully.", 201);
  } catch (error) {
    return json(
      false,
      error instanceof Error ? error.message : "Unable to submit registration.",
      500
    );
  }
}
