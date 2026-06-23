import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  buildRegistrationLeadPayload,
  normalizeText,
  resetFalseVoucherCreatedLeads,
  upsertRegistrationLead,
  validateRegistrationLead,
} from "@/lib/registrationLeads";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

async function readPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return {};
}

function hasWebhookAccess(request, session) {
  const role = String(session?.user?.role || "").toLowerCase();
  if (session?.user && ALLOWED_ROLES.has(role)) {
    return true;
  }

  const secret = normalizeText(process.env.GOOGLE_FORM_WEBHOOK_SECRET);
  const headerSecret = normalizeText(request.headers.get("x-google-form-secret"));

  return Boolean(secret) && headerSecret === secret;
}

export async function POST(request) {
  const session = await auth();

  if (!hasWebhookAccess(request, session)) {
    return json("Unauthorized.", 401);
  }

  try {
    const body = await readPayload(request);
    const lead = buildRegistrationLeadPayload(body);
    const validationError = validateRegistrationLead(lead);

    if (validationError) {
      return json(validationError, 400);
    }

    const record = await upsertRegistrationLead(lead, prisma);
    await resetFalseVoucherCreatedLeads(prisma);

    return json("Registration lead stored.", 201, {
      item: record,
    });
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to store Google Form registration lead.",
      500
    );
  }
}
