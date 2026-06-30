import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export async function GET(request) {
  const secret = String(request.nextUrl.searchParams.get("secret") || "");
  if (!process.env.MONTHLY_REMINDER_SECRET || secret !== process.env.MONTHLY_REMINDER_SECRET) {
    return json("Forbidden.", 403);
  }

  try {
    const reminders = await prisma.$queryRaw`
      SELECT
        item.id::text AS item_id,
        item.voucher_id::text AS voucher_id,
        item.voucher_no,
        item.student_name,
        item.student_email,
        item.parent_name,
        item.parent_email,
        item.due_date,
        item.base_amount::float8 AS base_amount,
        item.late_fee_amount::float8 AS late_fee_amount,
        c.title AS class_title
      FROM regular_monthly_fee_voucher_items item
      INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
      INNER JOIN regular_monthly_fee_batches b ON b.id = item.batch_id
      INNER JOIN courses c ON c.id = b.class_id
      LEFT JOIN fee_submissions fs ON fs.voucher_id = fv.id
      WHERE item.due_date = CURRENT_DATE + INTERVAL '3 days'
        AND COALESCE(fs.status::text, fv.status::text, 'unpaid') IN ('unpaid', 'rejected', 'submitted')
      ORDER BY item.due_date ASC, item.created_at ASC
    `;

    const portalBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    let sent = 0;

    for (const item of reminders) {
      const to = isValidEmail(item.parent_email)
        ? String(item.parent_email).trim().toLowerCase()
        : isValidEmail(item.student_email)
          ? String(item.student_email).trim().toLowerCase()
          : "";

      if (!to) continue;

      await sendEmail({
        to,
        subject: `Monthly fee reminder for ${item.class_title || "your class"}`,
        html: `
          <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
            <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
              <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0284c7;font-weight:700;">Monthly fee reminder</p>
              <h2 style="margin:0 0 16px;">Your monthly fee is due soon</h2>
              <p style="margin:0 0 16px;">Assalamualaikum ${item.parent_name || item.student_name || "Parent"}, your monthly fee voucher will be due on <strong>${formatDate(item.due_date)}</strong>.</p>
              <p style="margin:0 0 16px;">Voucher No: <strong>${item.voucher_no}</strong></p>
              <p style="margin:0 0 16px;">Amount: <strong>PKR ${Number(item.base_amount || 0).toLocaleString("en-PK")}</strong>${Number(item.late_fee_amount || 0) > 0 ? ` + late fee PKR ${Number(item.late_fee_amount || 0).toLocaleString("en-PK")}` : ""}</p>
              <p style="margin:0 0 16px;">Please submit payment to continue LMS access.</p>
              <p style="margin:0;"><a href="${portalBase}/payment/${encodeURIComponent(item.voucher_no)}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:700;">Open Voucher</a></p>
            </div>
          </div>
        `,
        text: `Monthly fee reminder\n\nVoucher No: ${item.voucher_no}\nDue Date: ${formatDate(item.due_date)}\nPlease submit payment to continue LMS access.\n\nOpen Voucher: ${portalBase}/payment/${encodeURIComponent(item.voucher_no)}`,
      });
      sent += 1;
    }

    return json("Monthly fee reminders processed.", 200, { reminders: reminders.length, sent });
  } catch (error) {
    return json(error instanceof Error ? error.message : "Unable to process monthly fee reminders.", 500);
  }
}
