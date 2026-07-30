import { NextResponse } from "next/server";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import prisma from "@/lib/prisma";
import { computeFeeHistoryAmounts, feeHistoryTableExists, normalizeMoney } from "@/lib/feeHistory";

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadStudentSummaries() {
  return prisma.$queryRaw`
    SELECT
      sp.id::text AS student_id,
      COALESCE(u.full_name, '') AS student_name,
      COALESCE(u.email, '') AS student_email,
      COALESCE(u.phone, '') AS student_phone,
      COALESCE(pu.full_name, '') AS parent_name,
      COALESCE(pu.email, '') AS parent_email,
      COALESCE(pu.phone, '') AS parent_phone,
      COALESCE(sp.admission_no, '') AS admission_no,
      COALESCE(NULLIF(c.class_level, ''), c.title, '') AS class_level,
      COALESCE(latest.month_label, '') AS latest_month_label,
      COALESCE(latest.this_month_paid::float8, 0) AS latest_this_month_paid,
      COALESCE(latest.remaining_due::float8, 0) AS current_pending_dues,
      COALESCE(latest.history_count::int, 0) AS history_count
    FROM student_profiles sp
    INNER JOIN users u ON u.id = sp.user_id
    INNER JOIN LATERAL (
      SELECT e.id, e.registration_id, e.course_id
      FROM enrollments e
      WHERE e.student_id = sp.id
        AND LOWER(COALESCE(e.status, 'active')) = 'active'
      ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, e.id DESC
      LIMIT 1
    ) enr ON TRUE
    LEFT JOIN courses c ON c.id = enr.course_id
    LEFT JOIN student_parents spp ON spp.student_id = sp.id AND spp.is_primary = TRUE
    LEFT JOIN parent_profiles pp ON pp.id = spp.parent_id
    LEFT JOIN users pu ON pu.id = pp.user_id
    LEFT JOIN LATERAL (
      SELECT
        combined.month_label,
        combined.this_month_paid,
        combined.remaining_due,
        combined.sort_date,
        (
          SELECT COUNT(*)
          FROM fee_history_records fhr_count
          WHERE fhr_count.student_id = sp.id
        ) AS history_count
      FROM (
        SELECT
          COALESCE(fhr.month_label, '') AS month_label,
          COALESCE(fhr.this_month_paid::float8, 0) AS this_month_paid,
          COALESCE(fhr.remaining_due::float8, 0) AS remaining_due,
          COALESCE(fhr.due_date::timestamp, fhr.created_at) AS sort_date
        FROM fee_history_records fhr
        WHERE fhr.student_id = sp.id

        UNION ALL

        SELECT
          COALESCE(batch.month_label, TO_CHAR(item.due_date, 'Mon YYYY')) AS month_label,
          COALESCE(fs.paid_amount::float8, 0) AS this_month_paid,
          (
            COALESCE(fv.total_amount::float8, fv.amount::float8, (COALESCE(item.base_amount::float8, 0) + COALESCE(item.late_fee_amount::float8, 0)))
            - COALESCE(fs.paid_amount::float8, 0)
          ) AS remaining_due,
          COALESCE(item.due_date::timestamp, item.created_at) AS sort_date
        FROM regular_monthly_fee_voucher_items item
        INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
        LEFT JOIN regular_monthly_fee_batches batch ON batch.id = item.batch_id
        LEFT JOIN LATERAL (
          SELECT status, paid_amount
          FROM fee_submissions fs
          WHERE fs.voucher_id = fv.id
          ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
          LIMIT 1
        ) fs ON TRUE
        WHERE item.student_id = sp.id
          AND LOWER(COALESCE(fs.status::text, fv.status::text, '')) = 'verified'
          AND NOT EXISTS (
            SELECT 1
            FROM fee_history_records fhr_link
            WHERE fhr_link.voucher_id = fv.id
          )

        UNION ALL

        SELECT
          COALESCE(TO_CHAR(fv.due_date, 'Mon YYYY'), 'Admission') AS month_label,
          COALESCE(fs.paid_amount::float8, 0) AS this_month_paid,
          (
            COALESCE(fv.total_amount::float8, fv.amount::float8, 0)
            - COALESCE(fs.paid_amount::float8, 0)
          ) AS remaining_due,
          COALESCE(fv.due_date::timestamp, fv.created_at) AS sort_date
        FROM fee_vouchers fv
        LEFT JOIN LATERAL (
          SELECT status, paid_amount
          FROM fee_submissions fs
          WHERE fs.voucher_id = fv.id
          ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
          LIMIT 1
        ) fs ON TRUE
        WHERE fv.registration_id = enr.registration_id
          AND fv.registration_id IS NOT NULL
          AND LOWER(COALESCE(fs.status::text, fv.status::text, '')) = 'verified'
          AND NOT EXISTS (
            SELECT 1
            FROM regular_monthly_fee_voucher_items item2
            WHERE item2.voucher_id = fv.id
          )
          AND NOT EXISTS (
            SELECT 1
            FROM fee_history_records fhr_link
            WHERE fhr_link.voucher_id = fv.id
          )
      ) combined
      ORDER BY combined.sort_date DESC NULLS LAST
      LIMIT 1
    ) latest ON TRUE
    WHERE COALESCE(sp.status, 'active'::user_status) = 'active'::user_status
      AND u.status = 'active'::user_status
    ORDER BY u.full_name ASC
  `;
}

async function loadStudentHistory(studentId) {
  const [registrationRow] = await prisma.$queryRaw`
    SELECT e.registration_id::text AS registration_id
    FROM enrollments e
    WHERE e.student_id = ${studentId}::uuid
      AND LOWER(COALESCE(e.status, 'active')) = 'active'
    ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, e.id DESC
    LIMIT 1
  `;
  const registrationId = normalizeText(registrationRow?.registration_id);

  return prisma.$queryRaw`
    SELECT *
    FROM (
      SELECT
        fhr.id::text AS id,
        'history'::text AS source_type,
        fhr.student_id::text AS student_id,
        fhr.batch_id::text AS batch_id,
        fhr.voucher_id::text AS voucher_id,
        fhr.registration_id::text AS registration_id,
        COALESCE(fhr.month_label, '') AS month_label,
        fhr.due_date,
        COALESCE(fhr.previous_month_due::float8, 0) AS previous_month_due,
        COALESCE(fhr.discount_amount::float8, COALESCE(fv.discount_amount::float8, 0)) AS discount_amount,
        COALESCE(fhr.current_month_fee::float8, COALESCE(fv.total_amount::float8, fv.amount::float8, 0)) AS current_month_fee,
        COALESCE(fhr.total_amount::float8, COALESCE(fv.total_amount::float8, fv.amount::float8, 0)) AS total_amount,
        COALESCE(fhr.this_month_paid::float8, COALESCE(fs.paid_amount::float8, 0)) AS this_month_paid,
        COALESCE(fhr.remaining_due::float8, (COALESCE(fv.total_amount::float8, fv.amount::float8, 0) - COALESCE(fs.paid_amount::float8, 0))) AS remaining_due,
        COALESCE(fv.voucher_no, '') AS voucher_no,
        LOWER(COALESCE(fs.status::text, fv.status::text, 'not_submitted')) AS payment_status,
        fs.paid_at,
        COALESCE(fv.discount_percent::float8, 0) AS discount_percent,
        COALESCE(fv.admission_fee_amount::float8, 0) AS admission_fee_amount,
        COALESCE(fv.regular_fee_amount::float8, 0) AS regular_fee_amount,
        fhr.created_at,
        fhr.updated_at,
        COALESCE(fhr.due_date::timestamp, fhr.created_at) AS sort_date
      FROM fee_history_records fhr
      LEFT JOIN fee_vouchers fv ON fv.id = fhr.voucher_id
      LEFT JOIN LATERAL (
        SELECT status, paid_at, paid_amount
        FROM fee_submissions fs
        WHERE fs.voucher_id = fhr.voucher_id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE fhr.student_id = ${studentId}::uuid

      UNION ALL

      SELECT
        ('voucher-item-' || fv.id::text) AS id,
        'voucher'::text AS source_type,
        COALESCE(item.student_id::text, ${studentId}::text) AS student_id,
        item.batch_id::text AS batch_id,
        fv.id::text AS voucher_id,
        ${registrationId || null}::text AS registration_id,
        COALESCE(batch.month_label, TO_CHAR(COALESCE(item.due_date, fv.due_date), 'Mon YYYY')) AS month_label,
        COALESCE(item.due_date, fv.due_date) AS due_date,
        0::float8 AS previous_month_due,
        COALESCE(fv.discount_amount::float8, 0) AS discount_amount,
        COALESCE(
          fv.total_amount::float8,
          (
            COALESCE(fv.regular_fee_amount::float8, COALESCE(item.base_amount::float8, 0))
            + COALESCE(fv.admission_fee_amount::float8, 0)
            - COALESCE(fv.discount_amount::float8, 0)
          ),
          fv.amount::float8,
          (COALESCE(item.base_amount::float8, 0) + COALESCE(item.late_fee_amount::float8, 0))
        ) AS current_month_fee,
        COALESCE(
          fv.total_amount::float8,
          (
            COALESCE(fv.regular_fee_amount::float8, COALESCE(item.base_amount::float8, 0))
            + COALESCE(fv.admission_fee_amount::float8, 0)
            - COALESCE(fv.discount_amount::float8, 0)
          ),
          fv.amount::float8,
          (COALESCE(item.base_amount::float8, 0) + COALESCE(item.late_fee_amount::float8, 0))
        ) AS total_amount,
        COALESCE(fs.paid_amount::float8, 0) AS this_month_paid,
        (
          COALESCE(
            fv.total_amount::float8,
            (
              COALESCE(fv.regular_fee_amount::float8, COALESCE(item.base_amount::float8, 0))
              + COALESCE(fv.admission_fee_amount::float8, 0)
              - COALESCE(fv.discount_amount::float8, 0)
            ),
            fv.amount::float8,
            (COALESCE(item.base_amount::float8, 0) + COALESCE(item.late_fee_amount::float8, 0))
          )
          - COALESCE(fs.paid_amount::float8, 0)
        ) AS remaining_due,
        COALESCE(fv.voucher_no, '') AS voucher_no,
        LOWER(COALESCE(fs.status::text, fv.status::text, 'not_submitted')) AS payment_status,
        fs.paid_at,
        COALESCE(fv.discount_percent::float8, 0) AS discount_percent,
        COALESCE(fv.admission_fee_amount::float8, 0) AS admission_fee_amount,
        COALESCE(fv.regular_fee_amount::float8, COALESCE(item.base_amount::float8, 0)) AS regular_fee_amount,
        COALESCE(item.created_at, fv.created_at) AS created_at,
        COALESCE(item.updated_at, fv.updated_at) AS updated_at,
        COALESCE(item.due_date::timestamp, fv.due_date::timestamp, COALESCE(item.created_at, fv.created_at)) AS sort_date
      FROM regular_monthly_fee_voucher_items item
      INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
      LEFT JOIN regular_monthly_fee_batches batch ON batch.id = item.batch_id
      LEFT JOIN LATERAL (
        SELECT status, paid_at, paid_amount
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE item.student_id = ${studentId}::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM fee_history_records fhr_link
          WHERE fhr_link.voucher_id = fv.id
        )

      UNION ALL

      SELECT
        ('voucher-direct-' || fv.id::text) AS id,
        'voucher'::text AS source_type,
        ${studentId}::text AS student_id,
        NULL::text AS batch_id,
        fv.id::text AS voucher_id,
        fv.registration_id::text AS registration_id,
        COALESCE(TO_CHAR(fv.due_date, 'Mon YYYY'), 'Admission') AS month_label,
        fv.due_date,
        0::float8 AS previous_month_due,
        COALESCE(fv.discount_amount::float8, 0) AS discount_amount,
        COALESCE(
          fv.total_amount::float8,
          (
            COALESCE(fv.regular_fee_amount::float8, 0)
            + COALESCE(fv.admission_fee_amount::float8, 0)
            - COALESCE(fv.discount_amount::float8, 0)
          ),
          fv.amount::float8
        ) AS current_month_fee,
        COALESCE(
          fv.total_amount::float8,
          (
            COALESCE(fv.regular_fee_amount::float8, 0)
            + COALESCE(fv.admission_fee_amount::float8, 0)
            - COALESCE(fv.discount_amount::float8, 0)
          ),
          fv.amount::float8
        ) AS total_amount,
        COALESCE(fs.paid_amount::float8, 0) AS this_month_paid,
        (
          COALESCE(
            fv.total_amount::float8,
            (
              COALESCE(fv.regular_fee_amount::float8, 0)
              + COALESCE(fv.admission_fee_amount::float8, 0)
              - COALESCE(fv.discount_amount::float8, 0)
            ),
            fv.amount::float8
          )
          - COALESCE(fs.paid_amount::float8, 0)
        ) AS remaining_due,
        COALESCE(fv.voucher_no, '') AS voucher_no,
        LOWER(COALESCE(fs.status::text, fv.status::text, 'not_submitted')) AS payment_status,
        fs.paid_at,
        COALESCE(fv.discount_percent::float8, 0) AS discount_percent,
        COALESCE(fv.admission_fee_amount::float8, 0) AS admission_fee_amount,
        COALESCE(fv.regular_fee_amount::float8, 0) AS regular_fee_amount,
        fv.created_at,
        fv.updated_at,
        COALESCE(fv.due_date::timestamp, fv.created_at) AS sort_date
      FROM fee_vouchers fv
      LEFT JOIN LATERAL (
        SELECT status, paid_at, paid_amount
        FROM fee_submissions fs
        WHERE fs.voucher_id = fv.id
        ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
        LIMIT 1
      ) fs ON TRUE
      WHERE fv.registration_id = ${registrationId || null}::uuid
        AND NOT EXISTS (
          SELECT 1
          FROM regular_monthly_fee_voucher_items item2
          WHERE item2.voucher_id = fv.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM fee_history_records fhr_link
          WHERE fhr_link.voucher_id = fv.id
        )
    ) fee_rows
    ORDER BY sort_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
  `;
}

async function propagateHistory(tx, rowId) {
  const [targetRow] = await tx.$queryRaw`
    SELECT id::text AS id, student_id::text AS student_id
    FROM fee_history_records
    WHERE id = ${rowId}::uuid
    LIMIT 1
  `;

  if (!targetRow?.id) {
    throw new Error("Fee history row not found.");
  }

  const rows = await tx.$queryRaw`
    SELECT
      id::text AS id,
      due_date,
      created_at,
      previous_month_due::float8 AS previous_month_due,
      current_month_fee::float8 AS current_month_fee,
      this_month_paid::float8 AS this_month_paid
    FROM fee_history_records
    WHERE student_id = ${targetRow.student_id}::uuid
    ORDER BY due_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
  `;

  const targetIndex = rows.findIndex((item) => item.id === targetRow.id);
  if (targetIndex === -1) {
    throw new Error("Fee history row not found in sequence.");
  }

  let carryForward = null;
  for (let index = targetIndex; index < rows.length; index += 1) {
    const item = rows[index];
    const previousMonthDue = index === targetIndex
      ? normalizeMoney(item.previous_month_due)
      : normalizeMoney(carryForward);
    const computed = computeFeeHistoryAmounts({
      previousMonthDue,
      currentMonthFee: item.current_month_fee,
      thisMonthPaid: item.this_month_paid,
    });

    await tx.$executeRaw`
      UPDATE fee_history_records
      SET
        previous_month_due = ${computed.previousMonthDue},
        total_amount = ${computed.totalAmount},
        remaining_due = ${computed.remainingDue},
        updated_at = NOW()
      WHERE id = ${item.id}::uuid
    `;

    carryForward = computed.remainingDue;
  }

  return { studentId: targetRow.student_id };
}

export async function GET(request) {
  try {
    await requireRole(["coordinator"]);

    if (!(await feeHistoryTableExists(prisma))) {
      return json("Fee history table is not available yet. Please run the provided SQL script first.", 200, { items: [] });
    }

    const { searchParams } = new URL(request.url);
    const studentId = normalizeText(searchParams.get("studentId"));

    if (studentId) {
      const items = await loadStudentHistory(studentId);
      return json("Fee history loaded.", 200, { items });
    }

    const items = await loadStudentSummaries();
    return json("Fee history students loaded.", 200, { items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to load fee history.", 500);
  }
}

export async function PATCH(request) {
  try {
    await requireRole(["coordinator"]);

    if (!(await feeHistoryTableExists(prisma))) {
      return json("Fee history table is not available yet. Please run the provided SQL script first.", 400);
    }

    const body = await request.json();
    const rowId = normalizeText(body?.rowId);
    const sourceType = normalizeText(body?.sourceType || "history");

    if (!rowId) return json("Fee history row id is required.", 400);

    const previousMonthDue = normalizeMoney(body?.previousMonthDue);
    const currentMonthFee = normalizeMoney(body?.currentMonthFee);
    const thisMonthPaid = normalizeMoney(body?.thisMonthPaid);
    const discountAmount = normalizeMoney(body?.discountAmount);

    if (sourceType === "voucher") {
      const studentId = normalizeText(body?.studentId);
      const voucherId = normalizeText(body?.voucherId);
      const batchId = normalizeText(body?.batchId);
      const registrationId = normalizeText(body?.registrationId);
      const monthLabel = normalizeText(body?.monthLabel);
      const dueDate = normalizeText(body?.dueDate);

      if (!studentId || !voucherId) {
        return json("Student and voucher details are required for this fee row.", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        const [existing] = await tx.$queryRaw`
          SELECT id::text AS id
          FROM fee_history_records
          WHERE voucher_id = ${voucherId}::uuid
          LIMIT 1
        `;

        let effectiveRowId = existing?.id || "";
        if (!effectiveRowId) {
          const computed = computeFeeHistoryAmounts({ previousMonthDue, currentMonthFee, thisMonthPaid });
          const [inserted] = await tx.$queryRaw`
            INSERT INTO fee_history_records (
              id,
              student_id,
              batch_id,
              voucher_id,
              registration_id,
              month_label,
              due_date,
              previous_month_due,
              discount_amount,
              current_month_fee,
              total_amount,
              this_month_paid,
              remaining_due,
              created_at,
              updated_at
            ) VALUES (
              gen_random_uuid(),
              ${studentId}::uuid,
              ${batchId || null}::uuid,
              ${voucherId}::uuid,
              ${registrationId || null}::uuid,
              ${monthLabel || null},
              ${dueDate || null}::date,
              ${computed.previousMonthDue},
              ${discountAmount},
              ${computed.currentMonthFee},
              ${computed.totalAmount},
              ${computed.thisMonthPaid},
              ${computed.remainingDue},
              NOW(),
              NOW()
            )
            RETURNING id::text AS id
          `;
          effectiveRowId = inserted.id;
        }

        const computed = computeFeeHistoryAmounts({ previousMonthDue, currentMonthFee, thisMonthPaid });
        await tx.$executeRaw`
          UPDATE fee_history_records
          SET
            previous_month_due = ${computed.previousMonthDue},
            discount_amount = ${discountAmount},
            current_month_fee = ${computed.currentMonthFee},
            total_amount = ${computed.totalAmount},
            this_month_paid = ${computed.thisMonthPaid},
            remaining_due = ${computed.remainingDue},
            updated_at = NOW()
          WHERE id = ${effectiveRowId}::uuid
        `;

        return propagateHistory(tx, effectiveRowId);
      });

      const items = await loadStudentHistory(result.studentId);
      return json("Fee history updated.", 200, { studentId: result.studentId, items });
    }

    const result = await prisma.$transaction(async (tx) => {
      const computed = computeFeeHistoryAmounts({ previousMonthDue, currentMonthFee, thisMonthPaid });

      await tx.$executeRaw`
        UPDATE fee_history_records
        SET
          previous_month_due = ${computed.previousMonthDue},
          discount_amount = ${discountAmount},
          current_month_fee = ${computed.currentMonthFee},
          total_amount = ${computed.totalAmount},
          this_month_paid = ${computed.thisMonthPaid},
          remaining_due = ${computed.remainingDue},
          updated_at = NOW()
        WHERE id = ${rowId}::uuid
      `;

      return propagateHistory(tx, rowId);
    });

    const items = await loadStudentHistory(result.studentId);
    return json("Fee history updated.", 200, { studentId: result.studentId, items });
  } catch (error) {
    const guard = roleGuardResponse(error);
    return guard || json(error instanceof Error ? error.message : "Unable to update fee history.", 500);
  }
}


