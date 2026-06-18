import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const [
      newLeadsRows,
      pendingVoucherRows,
      pendingPaymentRows,
      activeStudentRows,
      todayClassesRows,
      needsVerificationRows,
      missedClassesRows,
      rescheduledRows,
      recentLectures,
      recentLeads,
    ] = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM registration_leads WHERE status = 'new_lead'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_vouchers WHERE status = 'unpaid'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM student_profiles WHERE status = 'active'`,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM lecture_schedules
        WHERE scheduled_start >= ${todayStart}
          AND scheduled_start < ${todayEnd}
          AND status IN ('scheduled', 'upcoming', 'live', 'completed_by_teacher')
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM lecture_schedules
        WHERE status = 'completed_by_teacher'
      `,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status = 'missed'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM lecture_schedules WHERE status = 'rescheduled'`,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.status,
          ls.scheduled_start,
          s.full_name AS student_name,
          t.full_name AS teacher_name
        FROM lecture_schedules ls
        INNER JOIN student_profiles sp ON sp.id = ls.student_id
        INNER JOIN users s ON s.id = sp.user_id
        INNER JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        INNER JOIN users t ON t.id = tp.user_id
        ORDER BY ls.scheduled_start DESC
        LIMIT 6
      `,
      prisma.$queryRaw`
        SELECT
          id::text AS id,
          student_name,
          parent_name,
          status,
          created_at
        FROM registration_leads
        ORDER BY created_at DESC
        LIMIT 6
      `,
    ]);

    return json("Coordinator dashboard fetched.", 200, {
      stats: {
        newLeads: Number(newLeadsRows?.[0]?.total || 0),
        pendingVouchers: Number(pendingVoucherRows?.[0]?.total || 0),
        pendingPaymentVerifications: Number(pendingPaymentRows?.[0]?.total || 0),
        activeStudents: Number(activeStudentRows?.[0]?.total || 0),
        todayClasses: Number(todayClassesRows?.[0]?.total || 0),
        classesNeedingVerification: Number(needsVerificationRows?.[0]?.total || 0),
        missedClasses: Number(missedClassesRows?.[0]?.total || 0),
        rescheduledClasses: Number(rescheduledRows?.[0]?.total || 0),
      },
      recentLectures,
      recentLeads,
    });
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to fetch coordinator dashboard.",
      500
    );
  }
}

