import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendCustomEmail } from "@/lib/customEmailSender";

const ALLOWED_ROLES = new Set(["coordinator", "superadmin"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBodyHtml(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px;">${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function buildCustomEmailHtml({ subject, intro, message }) {
  const safeSubject = subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeIntro = intro.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `
    <div style="margin:0;padding:0;background:radial-gradient(circle at top left,rgba(201,162,39,.12),transparent 26%),radial-gradient(circle at top right,rgba(45,138,106,.12),transparent 24%),linear-gradient(180deg,#FAF7F0 0%,#F7F1E3 100%);font-family:Arial,sans-serif;color:#063F32;">
      <div style="max-width:760px;margin:0 auto;padding:20px 10px 26px;">
        <div style="background:linear-gradient(135deg,rgba(6,63,50,.98),rgba(13,92,72,.96));border:1px solid rgba(228,198,102,.45);border-radius:30px;overflow:hidden;box-shadow:0 24px 80px rgba(13,59,46,.18);">
          <div style="padding:22px 18px 18px;color:#FAF7F0;background:radial-gradient(circle at top right,rgba(228,198,102,.08),transparent 28%),radial-gradient(circle at bottom left,rgba(101,184,145,.12),transparent 30%),linear-gradient(135deg,rgba(6,63,50,.98),rgba(13,92,72,.96));">
            <p style="margin:0 0 10px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#E4C766;font-weight:800;">Ash-Shajrah Learning Hub</p>
            <div style="height:1px;width:180px;max-width:100%;background:linear-gradient(90deg,#E4C766,rgba(228,198,102,0));margin:0 0 14px;"></div>
            <h1 style="margin:0;font-size:24px;line-height:1.18;color:#FAF7F0;font-weight:700;">${safeSubject}</h1>
            ${safeIntro ? `<p style="margin:12px 0 0;max-width:560px;font-size:14px;line-height:1.65;color:#EAF6EF;">${safeIntro}</p>` : ""}
          </div>
          <div style="padding:18px 12px 20px;background:linear-gradient(180deg,rgba(255,255,255,.98) 0%,rgba(250,247,240,.98) 100%);">
            <div style="padding:16px;border:1px solid #2D8A6A;border-radius:18px;background:#fffaf0;color:#063F32;font-size:15px;line-height:1.8;">
              ${buildBodyHtml(message)}
            </div>
          </div>
          <div style="padding:18px 28px;background:linear-gradient(135deg,#0D5C48,#0B4E3D);color:#F7F1E3;border-top:1px solid rgba(228,198,102,.25);">
            <div style="display:block;text-align:center;font-size:12px;line-height:1.8;opacity:.95;">Ash-Shajrah Learning Hub LMS</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function isAllowedEmail(email) {
  return EMAIL_PATTERN.test(email) && !email.endsWith(".local") && !email.startsWith("no-email-");
}

function dedupeRecipients(values) {
  const seen = new Set();
  return values
    .map(normalizeEmail)
    .filter((email) => {
      if (!isAllowedEmail(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    });
}

export async function GET() {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (email)
        email,
        name,
        source,
        source_label
      FROM (
        SELECT
          LOWER(TRIM(per.email)) AS email,
          COALESCE(NULLIF(TRIM(per.participant_name), ''), NULLIF(TRIM(per.parent_name), ''), NULLIF(TRIM(per.student_name), ''), 'Event registrant') AS name,
          'public_event_registration' AS source,
          'Public event registration' AS source_label
        FROM public_event_registrations per
        WHERE COALESCE(NULLIF(TRIM(per.email), ''), '') <> ''
          AND LOWER(TRIM(per.email)) NOT LIKE 'no-email-%'
          AND LOWER(TRIM(per.email)) NOT LIKE '%.local'

        UNION ALL

        SELECT
          LOWER(TRIM(u.email)) AS email,
          COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.email), ''), 'LMS user') AS name,
          'user' AS source,
          'Verified LMS user' AS source_label
        FROM users u
        WHERE LOWER(COALESCE(u.status::text, 'active')) = 'active'
          AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
          AND LOWER(TRIM(u.email)) NOT LIKE 'no-email-%'
          AND LOWER(TRIM(u.email)) NOT LIKE '%.local'
      ) email_rows
      ORDER BY email, source DESC
    `;

    return json("Receiver emails fetched.", 200, {
      recipients: rows
        .filter((row) => isAllowedEmail(normalizeEmail(row.email)))
        .map((row) => ({
          email: row.email,
          name: row.name,
          source: row.source,
          source_label: row.source_label,
        })),
    });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to load receiver emails.", 500, { recipients: [] });
  }
}

export async function POST(request) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const formData = await request.formData();
    const subject = String(formData.get("subject") || "").trim();
    const intro = String(formData.get("intro") || "").trim();
    const message = String(formData.get("body") || "").trim();
    const parsedRecipients = JSON.parse(String(formData.get("recipients") || "[]"));
    const recipients = dedupeRecipients(Array.isArray(parsedRecipients) ? parsedRecipients : []);
    const imageFile = formData.get("image");
    const imageAttachment = imageFile instanceof File && imageFile.size > 0
      ? await (async () => {
          if (!String(imageFile.type || "").startsWith("image/")) {
            throw new Error("Only image attachments are supported.");
          }
          if (imageFile.size > 2 * 1024 * 1024) {
            throw new Error("Attached image must be 2 MB or smaller.");
          }
          const buffer = Buffer.from(await imageFile.arrayBuffer());
          return {
            filename: imageFile.name || "attached-image",
            contentType: imageFile.type,
            content: buffer,
          };
        })()
      : null;

    if (!subject) return json("Subject is required.", 400);
    if (!message) return json("Body is required.", 400);
    if (!recipients.length) return json("Select at least one receiver email.", 400);

    const html = buildCustomEmailHtml({ subject, intro, message });
    const text = [intro, message].filter(Boolean).join("\n\n");
    const attachments = imageAttachment ? [imageAttachment] : [];

    const results = await Promise.allSettled(
      recipients.map((email) => sendCustomEmail({ to: email, subject, html, text, attachments }))
    );
    const failed = results.filter((result) => result.status === "rejected").length;
    const sent = recipients.length - failed;

    if (failed) {
      return json(`${sent} email(s) sent. ${failed} email(s) failed.`, sent ? 207 : 500, { sent, failed });
    }

    return json(`${sent} email(s) sent successfully.`, 200, { sent, failed: 0 });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to send emails.", 500);
  }
}
