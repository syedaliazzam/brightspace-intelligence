import crypto from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAuditLog } from "@/lib/auditLog";
import { createCalendarLectureEvent } from "@/lib/googleCalendar";
import { requireRole, roleGuardResponse } from "@/lib/roleGuard";

const ALLOWED_ROLES = ["admin", "coordinator"];

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function upsertVerification(tx, payload) {
  const [existing] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM lecture_verifications
    WHERE lecture_id = ${payload.lectureId}::uuid
    LIMIT 1
  `;

  if (existing?.id) {
    await tx.$executeRaw`
      UPDATE lecture_verifications
      SET verified_by = ${payload.verifiedBy}::uuid,
          decision = ${payload.decision}::verification_decision,
          remarks = ${payload.remarks || null},
          verified_at = NOW()
      WHERE id = ${existing.id}::uuid
    `;
    return existing.id;
  }

  const id = crypto.randomUUID();
  await tx.$executeRaw`
    INSERT INTO lecture_verifications (
      id,
      lecture_id,
      verified_by,
      decision,
      remarks,
      verified_at
    )
    VALUES (
      ${id}::uuid,
      ${payload.lectureId}::uuid,
      ${payload.verifiedBy}::uuid,
      ${payload.decision}::verification_decision,
      ${payload.remarks || null},
      NOW()
    )
  `;

  return id;
}

export async function PATCH(request, context) {
  try {
    const session = await requireRole(ALLOWED_ROLES);
    const { id } = await context.params;
    const body = await request.json();
    const action = normalizeText(body?.action).toLowerCase();
    const remarks = normalizeText(body?.remarks);
    const scheduledStart = normalizeText(body?.scheduledStart);
    const scheduledEnd = normalizeText(body?.scheduledEnd);

    const [lecture] = await prisma.$queryRaw`
      SELECT
        ls.id::text AS id,
        ls.enrollment_id::text AS enrollment_id,
        ls.student_id::text AS student_id,
        ls.teacher_id::text AS teacher_id,
        ls.subject_id::text AS subject_id,
        ls.title,
        ls.description,
        ls.status::text AS status
      FROM lecture_schedules ls
      WHERE ls.id = ${id}::uuid
      LIMIT 1
    `;

    if (!lecture?.id) {
      return json("Lecture not found.", 404);
    }

    if (!["approve", "reject", "mark_missed", "reschedule"].includes(action)) {
      return json("Invalid verification action.", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      if (action === "approve") {
        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "approved",
          remarks,
        });

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'verified_by_coordinator'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "approved", remarks },
          },
          tx
        );

        return { status: "verified_by_coordinator" };
      }

      if (action === "reject") {
        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "rejected",
          remarks,
        });

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'disputed'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "rejected", remarks },
          },
          tx
        );

        return { status: "disputed" };
      }

      if (action === "mark_missed") {
        const verificationId = await upsertVerification(tx, {
          lectureId: id,
          verifiedBy: session.user.id,
          decision: "needs_review",
          remarks: remarks || "Marked as missed.",
        });

        await tx.$executeRaw`
          UPDATE lecture_schedules
          SET status = 'missed'::lecture_status,
              updated_at = NOW()
          WHERE id = ${id}::uuid
        `;

        await createAuditLog(
          {
            actorUserId: session.user.id,
            action: "lecture_verified",
            entityType: "lecture_verifications",
            entityId: verificationId,
            newData: { lectureId: id, decision: "missed", remarks },
          },
          tx
        );

        return { status: "missed" };
      }

      if (!scheduledStart || !scheduledEnd) {
        throw new Error("New schedule start and end are required for rescheduling.");
      }

      let calendarData = { eventId: "", meetLink: "", meetSpaceId: "" };
      try {
        calendarData = await createCalendarLectureEvent({
          title: lecture.title,
          description: lecture.description,
          start: scheduledStart,
          end: scheduledEnd,
        });
      } catch {}

      const [newLecture] = await tx.$queryRaw`
        INSERT INTO lecture_schedules (
          id,
          enrollment_id,
          student_id,
          teacher_id,
          subject_id,
          scheduled_by,
          title,
          description,
          scheduled_start,
          scheduled_end,
          google_calendar_event_id,
          google_meet_link,
          google_meet_space_id,
          status,
          rescheduled_from_id,
          created_at,
          updated_at
        )
        VALUES (
          ${crypto.randomUUID()}::uuid,
          ${lecture.enrollment_id}::uuid,
          ${lecture.student_id}::uuid,
          ${lecture.teacher_id}::uuid,
          ${lecture.subject_id}::uuid,
          ${session.user.id}::uuid,
          ${lecture.title},
          ${lecture.description || null},
          ${scheduledStart}::timestamp,
          ${scheduledEnd}::timestamp,
          ${calendarData.eventId || null},
          ${calendarData.meetLink || null},
          ${calendarData.meetSpaceId || null},
          'scheduled'::lecture_status,
          ${id}::uuid,
          NOW(),
          NOW()
        )
        RETURNING id::text AS id
      `;

      await tx.$executeRaw`
        UPDATE lecture_schedules
        SET status = 'rescheduled'::lecture_status,
            updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      await upsertVerification(tx, {
        lectureId: id,
        verifiedBy: session.user.id,
        decision: "reschedule",
        remarks,
      });

      await createAuditLog(
        {
          actorUserId: session.user.id,
          action: "lecture_rescheduled",
          entityType: "lecture_schedules",
          entityId: newLecture.id,
          oldData: { lectureId: id },
          newData: { rescheduledFromId: id, scheduledStart, scheduledEnd },
        },
        tx
      );

      return { status: "rescheduled", newLectureId: newLecture.id };
    });

    return json("Lecture verification updated.", 200, result);
  } catch (error) {
    const guard = roleGuardResponse(error);
    if (guard) {
      return guard;
    }

    return json(
      error instanceof Error ? error.message : "Unable to update lecture verification.",
      500
    );
  }
}

