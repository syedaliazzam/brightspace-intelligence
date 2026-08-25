import { redirect } from "next/navigation";
import DiscountFilterForm from "@/components/coordinator/DiscountFilterForm";
import { auth, roleToDashboard } from "@/lib/auth";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator", "superadmin"]);

const COLUMN_OPTIONS = [
  { label: "All columns", value: "all" },
  { label: "Student", value: "student" },
  { label: "Parent", value: "parent" },
  { label: "Voucher", value: "voucher" },
  { label: "Class", value: "class" },
  { label: "Voucher type", value: "voucher_type" },
  { label: "Status", value: "status" },
];

async function getDiscountRecords() {
  try {
    return await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.created_at,
        fv.due_date,
        fv.status::text AS voucher_status,
        COALESCE(fv.regular_fee_amount::float8, 0) AS monthly_fee,
        COALESCE(fv.admission_fee_amount::float8, 0) AS admission_fee_amount,
        COALESCE(fv.discount_percent::float8, 0) AS discount_percent,
        COALESCE(fv.discount_amount::float8, 0) AS discount_amount,
        COALESCE(fv.scholarship_amount::float8, 0) AS scholarship_amount,
        COALESCE(fv.total_amount::float8, fv.amount::float8, 0) AS total_amount,
        CASE WHEN item.id IS NOT NULL THEN 'Monthly voucher' ELSE 'Admission voucher' END AS voucher_type,
        COALESCE(item.student_name, su.full_name, rl.student_name, '-') AS student_name,
        COALESCE(item.parent_name, rl.parent_name, '-') AS parent_name,
        COALESCE(c_month.class_level, c_month.title, rl.class_level, '-') AS class_level,
        EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.registration_id = fv.registration_id
             OR e.student_id = item.student_id
          LIMIT 1
        ) AS is_lms_enrolled
      FROM fee_vouchers fv
      LEFT JOIN registration_leads rl ON rl.id = fv.registration_id
      LEFT JOIN regular_monthly_fee_voucher_items item ON item.voucher_id = fv.id
      LEFT JOIN regular_monthly_fee_batches batch ON batch.id = item.batch_id
      LEFT JOIN courses c_month ON c_month.id = batch.class_id
      LEFT JOIN student_profiles sp ON sp.id = item.student_id
      LEFT JOIN users su ON su.id = sp.user_id
      WHERE COALESCE(fv.discount_amount::float8, 0) > 0
         OR COALESCE(fv.discount_percent::float8, 0) > 0
      ORDER BY fv.created_at DESC NULLS LAST, fv.voucher_no DESC NULLS LAST
    `;
  } catch (error) {
    console.error("Discount records query failed:", error);
    return [];
  }
}

export const dynamic = "force-dynamic";

export default async function CoordinatorDiscountPage({
  portalLabel = "Coordinator portal",
  description = "Review monthly fee discounts and voucher discount details in one place.",
} = {}) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user || !ALLOWED_ROLES.has(role)) {
    redirect(session?.user ? roleToDashboard[role] || "/login" : "/login");
  }

  const items = await getDiscountRecords();

  return (
    <div className="min-h-screen bg-[#FAF7F0] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="relative">
            <p className="inline-flex rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">
              {portalLabel}
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Discount records</h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">
              {description}
            </p>
          </div>
        </section>

        <DiscountFilterForm columnOptions={COLUMN_OPTIONS} items={items} />
      </div>
    </div>
  );
}
