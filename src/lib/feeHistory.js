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
  const remaining = total - paid;

  return {
    previousMonthDue: previous,
    currentMonthFee: current,
    thisMonthPaid: paid,
    totalAmount: total,
    remainingDue: remaining,
  };
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
  const [row] = await tx.$queryRaw`
    SELECT remaining_due::float8 AS remaining_due
    FROM fee_history_records
    WHERE student_id = ${studentId}::uuid
    ORDER BY due_date DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;

  return normalizeMoney(row?.remaining_due);
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
