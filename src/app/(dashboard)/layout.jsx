import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import DashboardShell from "@/components/layout/DashboardShell";

export const dynamic = "force-dynamic";

function isValidPhone(value) {
  return typeof value === "string" && value.trim().replace(/\D/g, "").length >= 7;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function getStudentProfileId(userId) {
  const [row] = await prisma.$queryRaw`
    SELECT sp.id::text AS id
    FROM student_profiles sp
    WHERE sp.user_id = ${userId}::uuid
    LIMIT 1
  `;
  return row?.id || "";
}

async function getBlockedMonthlyFeeForStudent(studentId) {
  if (!studentId) return null;

  const [monthlyRow] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      item.due_date,
      COALESCE(latest_fs.status::text, fv.status::text, 'unpaid') AS effective_status
    FROM regular_monthly_fee_voucher_items item
    INNER JOIN fee_vouchers fv ON fv.id = item.voucher_id
    LEFT JOIN LATERAL (
      SELECT fs.status, fs.created_at, fs.id
      FROM fee_submissions fs
      WHERE fs.voucher_id = fv.id
      ORDER BY fs.created_at DESC NULLS LAST, fs.id DESC
      LIMIT 1
    ) latest_fs ON true
    WHERE (
      item.student_id = ${studentId}::uuid
      OR fv.registration_id IN (
        SELECT e.registration_id
        FROM enrollments e
        WHERE e.student_id = ${studentId}::uuid
          AND e.registration_id IS NOT NULL
      )
    )
    ORDER BY fv.created_at DESC NULLS LAST, item.created_at DESC, fv.voucher_no DESC NULLS LAST
    LIMIT 1
  `;
  if (monthlyRow?.voucher_no) {
    const status = String(monthlyRow.effective_status || "").toLowerCase();
    const dueDate = monthlyRow.due_date ? new Date(monthlyRow.due_date) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = dueDate instanceof Date && !Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= today.getTime();
    if (["unpaid", "rejected", "submitted"].includes(status) && isOverdue) {
      return monthlyRow;
    }
    return null;
  }

  const [voucherRow] = await prisma.$queryRaw`
    SELECT
      fv.voucher_no,
      fv.due_date
    FROM fee_vouchers fv
    WHERE (
      fv.student_id = ${studentId}::uuid
      OR fv.registration_id IN (
        SELECT e.registration_id
        FROM enrollments e
        WHERE e.student_id = ${studentId}::uuid
          AND e.registration_id IS NOT NULL
      )
    )
      AND NOT EXISTS (
        SELECT 1
        FROM regular_monthly_fee_voucher_items item
        WHERE item.voucher_id = fv.id
      )
      AND LOWER(fv.status::text) IN ('unpaid', 'rejected', 'submitted')
      AND fv.due_date <= timezone('Asia/Karachi', now())::date
    ORDER BY fv.created_at DESC NULLS LAST, fv.voucher_no DESC NULLS LAST
    LIMIT 1
  `;
  if (voucherRow?.voucher_no) return voucherRow;

  return null;
}

async function getBlockedMonthlyFeeForParent(sessionUser) {
  const parentIdRows = await prisma.$queryRaw`
    SELECT pp.id::text AS id
    FROM parent_profiles pp
    WHERE pp.user_id = ${sessionUser.id}::uuid
    LIMIT 1
  `;
  const parentId = parentIdRows?.[0]?.id || "";
  if (!parentId) return null;

  const childRows = await prisma.$queryRaw`
    SELECT spp.student_id::text AS student_id
    FROM student_parents spp
    WHERE spp.parent_id = ${parentId}::uuid
  `;
  const studentIds = childRows.map((row) => row.student_id).filter(Boolean);
  if (!studentIds.length) return null;

  const rows = await Promise.all(studentIds.map((studentId) => getBlockedMonthlyFeeForStudent(studentId)));
  return rows.find(Boolean) || null;
}

export default async function DashboardLayout({ children }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = String(session.user.role || "").toLowerCase();
  let blockedRecord = null;
  if (role === "student") {
    try {
      blockedRecord = await getBlockedMonthlyFeeForStudent(await getStudentProfileId(session.user.id));
    } catch {
      blockedRecord = { error: true };
    }
  }

  if (blockedRecord?.voucher_no) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)] px-4">
        <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-white shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
          <div className="bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] px-8 py-6 text-[#FAF7F0]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFF5D6]">LMS access paused</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0]">
              Monthly fee due date has passed
            </h1>
          </div>
          <div className="space-y-4 px-8 py-7 text-center">
            <p className="text-sm leading-7 text-[#245C4F]">
              Voucher <span className="font-bold text-[#063F32]">{blockedRecord.voucher_no}</span> is overdue. Please submit the payment to continue LMS access.
            </p>
            {blockedRecord.due_date ? (
              <div className="inline-flex rounded-full border border-[#2D8A6A]/15 bg-[#EAF6EF] px-4 py-2 text-sm font-semibold text-[#063F32]">
                Due date: {formatDate(blockedRecord.due_date)}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (blockedRecord?.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)] px-4">
        <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-white shadow-[0_24px_80px_-36px_rgba(13,59,46,0.24)]">
          <div className="bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] px-8 py-6 text-[#FAF7F0]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#FFF5D6]">LMS access paused</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#FAF7F0]">
              Payment status could not be verified
            </h1>
          </div>
          <div className="px-8 py-7 text-center">
            <p className="text-sm leading-7 text-[#245C4F]">
              Please contact administration so we can confirm your monthly fee status.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
