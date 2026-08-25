import crypto from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { buildFeeVoucherEmailHtml, sendEmail } from "@/lib/email";
import { feeHistoryTableExists, getLatestFeeHistoryCarryForward, insertFeeHistoryRow } from "@/lib/feeHistory";

const ALLOWED_ROLES = ["admin", "coordinator", "superadmin"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value).toLowerCase());
}

function padSequence(value) {
  return String(value).padStart(4, "0");
}

function getVoucherPrefix(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `LMS-${year}${month}`;
}

async function getNextVoucherSequence(tx, date = new Date()) {
  const prefix = getVoucherPrefix(date);
  const likePattern = `${prefix}-%`;
  const [row] = await tx.$queryRaw(
    Prisma.sql`
      SELECT voucher_no
      FROM fee_vouchers
      WHERE voucher_no LIKE ${likePattern}
      ORDER BY voucher_no DESC
      LIMIT 1
    `
  );

  const lastVoucherNo = String(row?.voucher_no || "");
  return Number(lastVoucherNo.split("-").pop() || 0) + 1;
}

async function getClasses() {
  return prisma.$queryRaw`
    SELECT
      c.id::text AS id,
      COALESCE(NULLIF(c.class_level, ''), c.title) AS title,
      COALESCE(rf.amount::float8, 0) AS regular_fee_amount
    FROM courses c
    LEFT JOIN LATERAL (
      SELECT amount
      FROM regular_fee rf
      WHERE rf.status = 'active'
        AND LOWER(COALESCE(rf.class_level, '')) = LOWER(COALESCE(NULLIF(c.class_level, ''), c.title))
      ORDER BY rf.id DESC
      LIMIT 1
    ) rf ON TRUE
    WHERE COALESCE(c.status, 'active'::user_status) = 'active'::user_status
    ORDER BY title ASC
  `;
}

async function getHistory() {
  return prisma.$queryRaw`
    SELECT
      b.id::text AS id,
      b.batch_no,
      b.class_id::text AS class_id,
      c.title AS class_title,
      b.month_label,
      b.due_date,
      b.base_amount::float8 AS base_amount,
      b.late_fee_amount::float8 AS late_fee_amount,
      b.student_count::int AS student_count,
      b.total_amount::float8 AS total_amount,
      LOWER(b.status::text) AS status,
      b.created_at,
      b.created_by::text AS created_by,
      COALESCE(items.items, '[]'::json) AS items
    FROM regular_monthly_fee_batches b
    INNER JOIN courses c ON c.id = b.class_id
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', item.id::text,
          'voucher_id', item.voucher_id::text,
          'student_id', item.student_id::text,
          'student_name', item.student_name,
          'student_email', COALESCE(NULLIF(TRIM(item.student_email), ''), NULLIF(TRIM(su.email), ''), NULLIF(TRIM(rl.email), ''), NULLIF(TRIM(pu.email), '')),
          'student_phone', item.student_phone,
          'parent_name', item.parent_name,
          'parent_email', COALESCE(NULLIF(TRIM(item.parent_email), ''), NULLIF(TRIM(pu.email), ''), NULLIF(TRIM(rl.email), '')),
          'parent_phone', COALESCE(NULLIF(TRIM(item.parent_phone), ''), NULLIF(TRIM(pu.phone), ''), NULLIF(TRIM(rl.phone), '')),
          'base_amount', item.base_amount::float8,
          'late_fee_amount', item.late_fee_amount::float8,
          'due_date', item.due_date,
          'status', item.status,
          'voucher_no', fv.voucher_no,
          'voucher_status', fv.status::text,
          'fee_submission_id', fs.id::text,
          'payment_status', COALESCE(fs.status::text, 'not_submitted'),
          'transaction_id', fs.transaction_id,
          'paid_amount', fs.paid_amount::float8,
          'paid_at', fs.paid_at,
          'current_pending_due', COALESCE(fhr.previous_month_due::float8, previous_history.remaining_due::float8, 0),
          'total_amount', COALESCE(fhr.total_amount::float8, COALESCE(fv.total_amount::float8, fv.amount::float8, item.base_amount::float8, 0))
        )
        ORDER BY item.created_at ASC
      ) AS items
      FROM regular_monthly_fee_voucher_items item
      INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
      LEFT JOIN student_profiles sp ON sp.id = item.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN LATERAL (
        SELECT spp.parent_id
        FROM student_parents spp
        WHERE spp.student_id = item.student_id
        ORDER BY spp.is_primary DESC, spp.id DESC
        LIMIT 1
      ) primary_parent ON TRUE
      LEFT JOIN parent_profiles pp ON pp.id = primary_parent.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      LEFT JOIN LATERAL (
        SELECT
          fhr.previous_month_due,
          fhr.total_amount,
          fhr.remaining_due,
          COALESCE(fv_hist.voucher_no, '') AS history_voucher_no,
          fhr.created_at AS history_created_at,
          fhr.id AS history_id
        FROM fee_history_records fhr
        LEFT JOIN fee_vouchers fv_hist ON fv_hist.id = fhr.voucher_id
        WHERE fhr.voucher_id = item.voucher_id
        ORDER BY fv_hist.voucher_no DESC NULLS LAST, fhr.created_at DESC NULLS LAST, fhr.id DESC
        LIMIT 1
      ) fhr ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          fhr_prev.remaining_due
        FROM fee_history_records fhr_prev
        LEFT JOIN fee_vouchers fv_prev ON fv_prev.id = fhr_prev.voucher_id
        WHERE fhr_prev.student_id = item.student_id
          AND fhr_prev.voucher_id IS DISTINCT FROM item.voucher_id
          AND (
            ROW(
              COALESCE(fv_prev.voucher_no, ''),
              fhr_prev.created_at,
              fhr_prev.id
            ) < ROW(
              COALESCE(fhr.history_voucher_no, fv.voucher_no),
              COALESCE(fhr.history_created_at, item.created_at),
              COALESCE(fhr.history_id, item.id::uuid)
            )
          )
        ORDER BY fv_prev.voucher_no DESC NULLS LAST, fhr_prev.created_at DESC NULLS LAST, fhr_prev.id DESC
        LIMIT 1
      ) previous_history ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          fs.id,
          status,
          transaction_id,
          paid_amount,
          paid_at
        FROM fee_submissions fs
        WHERE fs.voucher_id = item.voucher_id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE item.batch_id = b.id
    ) items ON TRUE
    ORDER BY b.created_at DESC NULLS LAST, b.id DESC
  `;
}

async function getPaymentMethods() {
  return prisma.$queryRaw`
    SELECT
      pm.id::text AS id,
      pm.name,
      pm.bank_name,
      pm.account_title,
      pm.account_number,
      pm.iban,
      pm.branch_code,
      pm.instructions
    FROM payment_methods pm
    WHERE LOWER(pm.status::text) = 'active'
    ORDER BY pm.name ASC
  `;
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

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);
    const [classes, history, paymentMethods] = await Promise.all([
      getClasses(),
      getHistory(),
      getPaymentMethods(),
    ]);
    return json("Regular fee voucher data fetched.", 200, { classes, history, paymentMethods });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to load regular fee vouchers.", 500);
  }
}

export async function POST(request) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const body = await request.json();
    const classId = normalizeText(body?.classId);
    const dueDate = normalizeText(body?.dueDate);
    const monthLabel = normalizeText(body?.monthLabel);
    const baseAmount = Number(body?.baseAmount || 0);
    const lateFeeAmount = 0;
    const paymentMethodId = normalizeText(body?.paymentMethodId);

    if (!classId) return json("Class is required.", 400);
    if (!Number.isFinite(baseAmount) || baseAmount <= 0) return json("Base monthly fee is required.", 400);

    const [classRow] = await prisma.$queryRaw`
      SELECT id::text AS id, COALESCE(NULLIF(class_level, ''), title) AS title
      FROM courses
      WHERE id = ${classId}::uuid
      LIMIT 1
    `;
    if (!classRow?.id) return json("Class not found.", 404);

    const [students, paymentMethods] = await Promise.all([
      prisma.$queryRaw`
      SELECT
        sp.id::text AS student_id,
        e.registration_id::text AS registration_id,
        u.full_name AS student_name,
        COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(rl.email), '')) AS student_email,
        u.phone AS student_phone,
        COALESCE(pu.full_name, '') AS parent_name,
        COALESCE(NULLIF(TRIM(pu.email), ''), NULLIF(TRIM(rl.email), '')) AS parent_email,
        COALESCE(NULLIF(TRIM(pu.phone), ''), NULLIF(TRIM(rl.phone), '')) AS parent_phone
      FROM enrollments e
      INNER JOIN student_profiles sp ON sp.id = e.student_id
      INNER JOIN users u ON u.id = sp.user_id
      LEFT JOIN registration_leads rl ON rl.id = e.registration_id
      LEFT JOIN LATERAL (
        SELECT spp.parent_id
        FROM student_parents spp
        WHERE spp.student_id = sp.id
        ORDER BY spp.is_primary DESC, spp.id DESC
        LIMIT 1
      ) primary_parent ON TRUE
      LEFT JOIN parent_profiles pp ON pp.id = primary_parent.parent_id
      LEFT JOIN users pu ON pu.id = pp.user_id
      WHERE e.course_id = ${classId}::uuid
        AND LOWER(e.status) = 'active'
        AND COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
        AND u.status = 'active'::user_status
      ORDER BY u.full_name ASC
    `,
      getPaymentMethods(),
    ]);

    if (!students.length) return json("No verified students found in this class.", 400);

    const batchId = crypto.randomUUID();
    const batchNo = `RFB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-6)}`;
    const createdRows = [];
    const emailJobs = [];
    const voucherColumns = await getTableColumns("fee_vouchers");
    const historyTableReady = await feeHistoryTableExists(prisma);
    const paymentMethodSnapshot = paymentMethods.map((method) => ({
      id: String(method.id || ""),
      name: String(method.name || ""),
      bank_name: method.bank_name || null,
      account_title: method.account_title || null,
      account_number: method.account_number || null,
      iban: method.iban || null,
      branch_code: method.branch_code || null,
      instructions: method.instructions || null,
    }));

    await prisma.$transaction(async (tx) => {
      let voucherSequence = await getNextVoucherSequence(tx, new Date());

      await tx.$executeRaw`
        INSERT INTO regular_monthly_fee_batches (
          id, batch_no, class_id, month_label, due_date, base_amount, late_fee_amount, student_count, total_amount, status, created_by, created_at, updated_at
        ) VALUES (
          ${batchId}::uuid, ${batchNo}, ${classId}::uuid, ${monthLabel || null}, ${dueDate}::date, ${baseAmount}, ${lateFeeAmount}, ${students.length}, 0, 'active', ${session.user.id}::uuid, NOW(), NOW()
        )
      `;

      let batchTotalPayable = 0;

      for (const student of students) {
        const voucherNo = `${getVoucherPrefix(new Date())}-${padSequence(voucherSequence)}`;
        voucherSequence += 1;
        let computedCurrentPendingDue = 0;
        let computedTotalPayable = baseAmount;
        const paymentMethodColumnFragment = voucherColumns.has("payment_method_id")
          ? Prisma.sql`, "payment_method_id"`
          : Prisma.empty;
        const paymentMethodValueFragment = voucherColumns.has("payment_method_id")
          ? Prisma.sql`, ${paymentMethodId || null}::uuid`
          : Prisma.empty;
        const totalAmountColumnFragment = voucherColumns.has("total_amount")
          ? Prisma.sql`, "total_amount"`
          : Prisma.empty;
        const totalAmountValueFragment = voucherColumns.has("total_amount")
          ? Prisma.sql`, ${baseAmount}`
          : Prisma.empty;
        const regularFeeAmountColumnFragment = voucherColumns.has("regular_fee_amount")
          ? Prisma.sql`, "regular_fee_amount"`
          : Prisma.empty;
        const regularFeeAmountValueFragment = voucherColumns.has("regular_fee_amount")
          ? Prisma.sql`, ${baseAmount}`
          : Prisma.empty;
        const paymentMethodOptionsColumnFragment = voucherColumns.has("payment_method_options")
          ? Prisma.sql`, "payment_method_options"`
          : Prisma.empty;
        const paymentMethodOptionsValueFragment = voucherColumns.has("payment_method_options")
          ? Prisma.sql`, ${JSON.stringify(paymentMethodSnapshot)}::jsonb`
          : Prisma.empty;

        const [voucher] = await tx.$queryRaw`
          INSERT INTO fee_vouchers (
            "id", "voucher_no", "registration_id", "amount", "due_date", "status"
            ${paymentMethodColumnFragment}
            ${totalAmountColumnFragment}
            ${regularFeeAmountColumnFragment}
            ${paymentMethodOptionsColumnFragment},
            "payment_instructions", "created_at", "updated_at"
          ) VALUES (
            gen_random_uuid(), ${voucherNo}, ${student.registration_id || null}::uuid, ${baseAmount}, ${dueDate}::date, 'unpaid'::voucher_status
            ${paymentMethodValueFragment}
            ${totalAmountValueFragment}
            ${regularFeeAmountValueFragment}
            ${paymentMethodOptionsValueFragment},
            NULL, NOW(), NOW()
          )
          RETURNING id::text AS id
        `;

        await tx.$executeRaw`
          INSERT INTO regular_monthly_fee_voucher_items (
            id, batch_id, voucher_id, student_id, student_name, student_email, student_phone, parent_name, parent_email, parent_phone, base_amount, late_fee_amount, due_date, status, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), ${batchId}::uuid, ${voucher.id}::uuid, ${student.student_id}::uuid, ${student.student_name}, ${student.student_email || null}, ${student.student_phone || null}, ${student.parent_name || null}, ${student.parent_email || null}, ${student.parent_phone || null}, ${baseAmount}, ${lateFeeAmount}, ${dueDate}::date, 'created', NOW(), NOW()
          )
        `;

        if (historyTableReady) {
          computedCurrentPendingDue = await getLatestFeeHistoryCarryForward(tx, student.student_id);
          const computedHistory = await insertFeeHistoryRow({
            tx,
            studentId: student.student_id,
            batchId,
            voucherId: voucher.id,
            registrationId: student.registration_id || null,
            monthLabel: monthLabel || '',
            dueDate,
            previousMonthDue: computedCurrentPendingDue,
            discountAmount: 0,
            currentMonthFee: baseAmount,
            thisMonthPaid: 0,
          });
          computedTotalPayable = Number(computedHistory?.totalAmount || (baseAmount + computedCurrentPendingDue));
          if (voucherColumns.has("total_amount")) {
            await tx.$executeRaw`
              UPDATE fee_vouchers
              SET total_amount = ${computedTotalPayable}
              WHERE id = ${voucher.id}::uuid
            `;
          }
          createdRows.push({
            ...student,
            voucher_no: voucherNo,
            current_pending_due: computedCurrentPendingDue,
            total_amount: computedTotalPayable,
          });
        } else {
          createdRows.push({
            ...student,
            voucher_no: voucherNo,
            current_pending_due: computedCurrentPendingDue,
            total_amount: computedTotalPayable,
          });
        }
        emailJobs.push({
          to: isValidEmail(student.student_email)
            ? normalizeText(student.student_email).toLowerCase()
            : isValidEmail(student.parent_email)
              ? normalizeText(student.parent_email).toLowerCase()
              : "",
          studentName: student.student_name,
          voucherNo,
          amount: computedTotalPayable,
          current_pending_due: computedCurrentPendingDue,
        });
        batchTotalPayable += computedTotalPayable;
      }

      await tx.$executeRaw`
        UPDATE regular_monthly_fee_batches
        SET total_amount = ${batchTotalPayable},
            updated_at = NOW()
        WHERE id = ${batchId}::uuid
      `;
    }, { maxWait: 20000, timeout: 120000 });

    const portalUrlBase = String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    for (const job of emailJobs) {
      if (!job.to) continue;
      await sendEmail({
        to: job.to,
        subject: `Monthly fee voucher for ${classRow.title}`,
        html: buildFeeVoucherEmailHtml({
          studentName: job.studentName,
          voucherNo: job.voucherNo,
          monthlyFee: `PKR ${Number(baseAmount).toLocaleString("en-PK")}`,
          amount: `PKR ${Number(job.amount || baseAmount).toLocaleString("en-PK")}`,
          currentPendingDue: `PKR ${Number(job.current_pending_due || baseAmount).toLocaleString("en-PK")}`,
          dueDate,
          portalUrl: `${portalUrlBase}/payment/${encodeURIComponent(job.voucherNo)}`,
        }),
      });
    }

    return json("Regular fee vouchers created.", 200, {
      batchId,
      batchNo,
      classTitle: classRow.title,
      count: students.length,
      items: createdRows,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) return guard;
    return json(error instanceof Error ? error.message : "Unable to create regular fee vouchers.", 500);
  }
}

