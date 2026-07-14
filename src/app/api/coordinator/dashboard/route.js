import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import { getDayRange } from "@/lib/dateTime";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

export async function GET() {
  try {
    await requireRole(ALLOWED_ROLES);

    const todayRange = getDayRange(new Date());

    const [
      newLeadsRows,
      pendingVoucherRows,
      pendingPaymentRows,
      activeStudentRows,
      lectureApprovalRows,
      recentLectures,
      recentLeads,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM interested_students
        WHERE admission_form_sent_at IS NULL
          AND admission_form_submitted_at IS NULL
          AND LOWER(COALESCE(status::text, '')) NOT IN ('archived')
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM interested_students
        WHERE admission_form_sent_at IS NOT NULL
          AND admission_form_submitted_at IS NULL
          AND LOWER(COALESCE(admission_form_status::text, '')) IN ('sent', 'reminded', 'overdue', 'not_submitted', 'pending')
      `,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM fee_submissions WHERE status = 'pending'`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS total FROM student_profiles WHERE status = 'active'`,
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT ls.id)::int AS lectures_needing_approval
        FROM lecture_schedules ls
        LEFT JOIN lecture_verifications lv ON lv.lecture_id = ls.id
        WHERE ls.status::text = 'completed_by_teacher'
          AND (
            lv.id IS NULL
            OR LOWER(lv.decision::text) IN ('needs_review', 'reschedule')
          )
      `,
      prisma.$queryRaw`
        SELECT
          ls.id::text AS id,
          ls.title,
          ls.status,
          ls.scheduled_start,
          sub.name AS subject_name,
          t.full_name AS teacher_name,
          c.title AS class_name
        FROM lecture_schedules ls
        LEFT JOIN subjects sub ON sub.id = ls.subject_id
        LEFT JOIN teacher_profiles tp ON tp.id = ls.teacher_id
        LEFT JOIN users t ON t.id = tp.user_id
        LEFT JOIN enrollments e ON e.id = ls.enrollment_id
        LEFT JOIN courses c ON c.id = e.course_id
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
        lectureNeedsApproval: Number(lectureApprovalRows?.[0]?.lectures_needing_approval || 0),
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
