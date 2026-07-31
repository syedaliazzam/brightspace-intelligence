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
    const currentMonthFee = normalizeMoney(row?.current_month_fee ?? 0);
    const thisMonthPaid = normalizeMoney(row?.this_month_paid ?? 0);
    const computed = computeFeeHistoryAmounts({
      previousMonthDue: carryForward,
      currentMonthFee,
      thisMonthPaid,
    });

    carryForward = computed.remainingDue;
    computedById.set(String(row.id), {
      previous_month_due: computed.previousMonthDue,
      total_amount: computed.totalAmount,
      remaining_due: computed.remainingDue,
      computedPreviousMonthDue: computed.previousMonthDue,
      computedTotalAmount: computed.totalAmount,
      computedRemainingDue: computed.remainingDue,
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
