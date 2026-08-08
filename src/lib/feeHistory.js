import prisma from "@/lib/prisma";

export function normalizeMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function computeFeeHistoryAmounts({ previousMonthDue = 0, currentMonthFee = 0, thisMonthPaid = 0 }) {
  const previous = normalizeMoney(previousMonthDue);
  const current = normalizeMoney(currentMonthFee);
  const paid = normalizeMoney(thisMonthPaid);
  const total = previous + current;
  const remaining = Math.max(0, total - paid);

  return {
    previousMonthDue: previous,
    currentMonthFee: current,
    thisMonthPaid: paid,
    totalAmount: total,
    remainingDue: remaining,
  };
}

export function applyCarryForwardHistoryRows(historyItems = []) {
  if (!Array.isArray(historyItems)) return [];

  const sortedRows = [...historyItems].sort((left, right) => {
    const leftDate = left?.due_date ? new Date(left.due_date).getTime() : new Date(left?.created_at || left?.updated_at || 0).getTime();
    const rightDate = right?.due_date ? new Date(right.due_date).getTime() : new Date(right?.created_at || right?.updated_at || 0).getTime();

    if (Number.isNaN(leftDate) && Number.isNaN(rightDate)) return 0;
    if (Number.isNaN(leftDate)) return 1;
    if (Number.isNaN(rightDate)) return -1;
    if (leftDate !== rightDate) return leftDate - rightDate;

    const leftCreatedAt = new Date(left?.created_at || 0).getTime();
    const rightCreatedAt = new Date(right?.created_at || 0).getTime();
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    return String(left?.id || "").localeCompare(String(right?.id || ""));
  });

  const computedById = new Map();
  let carryForward = 0;

  sortedRows.forEach((row) => {
    const isStoredHistoryRow = String(row?.source_type || "").toLowerCase() === "history";
    const storedPreviousMonthDue = normalizeMoney(row?.previous_month_due);
    const storedTotalAmount = normalizeMoney(row?.total_amount);
    const storedRemainingDue = normalizeMoney(row?.remaining_due);
    const currentMonthFee = normalizeMoney(row?.current_month_fee ?? 0);
    const thisMonthPaid = normalizeMoney(row?.this_month_paid ?? 0);
    const computed = computeFeeHistoryAmounts({
      previousMonthDue: carryForward,
      currentMonthFee,
      thisMonthPaid,
    });

    const previousMonthDue = isStoredHistoryRow ? storedPreviousMonthDue : computed.previousMonthDue;
    const totalAmount = isStoredHistoryRow ? storedTotalAmount : computed.totalAmount;
    const remainingDue = isStoredHistoryRow ? storedRemainingDue : computed.remainingDue;

    carryForward = remainingDue;
    computedById.set(String(row.id), {
      previous_month_due: previousMonthDue,
      total_amount: totalAmount,
      remaining_due: remainingDue,
      computedPreviousMonthDue: previousMonthDue,
      computedTotalAmount: totalAmount,
      computedRemainingDue: remainingDue,
    });
  });

  return historyItems.map((row) => {
    const derived = computedById.get(String(row.id));
    return derived ? { ...row, ...derived } : row;
  });
}

export async function feeHistoryTableExists(tx = prisma) {
  const [row] = await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'fee_history_records'
    ) AS present
  `;

  return Boolean(row?.present);
}

export async function getLatestFeeHistoryCarryForward(tx, studentId) {
  const monthlyRows = await tx.$queryRaw`
    SELECT
      fee_history_records.id::text AS id,
      COALESCE(fv.voucher_no, '') AS voucher_no,
      fee_history_records.due_date,
      fee_history_records.created_at,
      fee_history_records.previous_month_due::float8 AS previous_month_due,
      fee_history_records.current_month_fee::float8 AS current_month_fee,
      fee_history_records.this_month_paid::float8 AS this_month_paid,
      fee_history_records.remaining_due::float8 AS remaining_due
    FROM fee_history_records
    LEFT JOIN fee_vouchers fv ON fv.id = fee_history_records.voucher_id
    WHERE fee_history_records.student_id = ${studentId}::uuid
      AND fee_history_records.batch_id IS NOT NULL
    ORDER BY fv.voucher_no ASC NULLS LAST, fee_history_records.created_at ASC NULLS LAST, fee_history_records.id ASC
  `;

  if (monthlyRows.length) {
    const latestMonthlyRow = monthlyRows.at(-1);
    return normalizeMoney(latestMonthlyRow?.remaining_due ?? 0);
  }

  const [admissionRow] = await tx.$queryRaw`
    SELECT
      COALESCE(
        fhr.remaining_due::float8,
        (
          COALESCE(fv.total_amount::float8, fv.amount::float8, 0)
          - COALESCE(fs.paid_amount::float8, 0)
        ),
        0
      ) AS remaining_due
    FROM enrollments e
    INNER JOIN fee_vouchers fv ON fv.registration_id = e.registration_id
    LEFT JOIN LATERAL (
      SELECT
        fee_history_records.remaining_due
      FROM fee_history_records
      WHERE fee_history_records.voucher_id = fv.id
      ORDER BY fee_history_records.created_at DESC NULLS LAST, fee_history_records.id DESC
      LIMIT 1
    ) fhr ON TRUE
    LEFT JOIN LATERAL (
      SELECT fs.paid_amount
      FROM fee_submissions fs
      WHERE fs.voucher_id = fv.id
      ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
      LIMIT 1
    ) fs ON TRUE
    WHERE e.student_id = ${studentId}::uuid
      AND LOWER(COALESCE(e.status, 'active')) = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM regular_monthly_fee_voucher_items item
        WHERE item.voucher_id = fv.id
      )
    ORDER BY fv.voucher_no DESC NULLS LAST, fv.created_at DESC NULLS LAST, fv.id DESC
    LIMIT 1
  `;

  return normalizeMoney(admissionRow?.remaining_due ?? 0);
}

export async function insertFeeHistoryRow({
  tx,
  studentId,
  batchId = null,
  voucherId = null,
  registrationId = null,
  monthLabel = "",
  dueDate = null,
  previousMonthDue = 0,
  discountAmount = 0,
  currentMonthFee = 0,
  thisMonthPaid = 0,
}) {
  const computed = computeFeeHistoryAmounts({ previousMonthDue, currentMonthFee, thisMonthPaid });

  await tx.$executeRaw`
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
    )
    VALUES (
      gen_random_uuid(),
      ${studentId}::uuid,
      ${batchId || null}::uuid,
      ${voucherId || null}::uuid,
      ${registrationId || null}::uuid,
      ${String(monthLabel || "").trim() || null},
      ${dueDate || null}::date,
      ${computed.previousMonthDue},
      ${normalizeMoney(discountAmount)},
      ${computed.currentMonthFee},
      ${computed.totalAmount},
      ${computed.thisMonthPaid},
      ${computed.remainingDue},
      NOW(),
      NOW()
    )
  `;

  return computed;
}

export async function recalculateStudentFeeHistory(tx, studentId) {
  const rows = await tx.$queryRaw`
    SELECT
      id::text AS id,
      due_date,
      created_at,
      previous_month_due::float8 AS previous_month_due,
      current_month_fee::float8 AS current_month_fee,
      this_month_paid::float8 AS this_month_paid
    FROM fee_history_records
    WHERE student_id = ${studentId}::uuid
    ORDER BY due_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
  `;

  let carryForward = 0;
  for (const item of rows) {
    const previousMonthDue = normalizeMoney(carryForward);
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
}
