import { notFound } from "next/navigation";
import PaymentSubmissionForm from "@/components/payment/PaymentSubmissionForm";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getVoucher(voucherNo) {
  const [item] = await prisma.$queryRaw`
      SELECT
        fv.id::text AS id,
        fv.voucher_no,
        fv.amount,
        fv.due_date,
        LOWER(fv.status::text) AS status,
        fv.payment_method,
        fv.payment_instructions,
        rl.student_name,
      rl.parent_name,
      rl.email,
      rl.phone
    FROM fee_vouchers fv
    INNER JOIN registration_leads rl ON rl.id = fv.registration_id
    WHERE fv.voucher_no = ${voucherNo}
    LIMIT 1
  `;

  return item;
}

export default async function PaymentVoucherPage({ params }) {
  const { voucherNo } = await params;
  const voucher = await getVoucher(voucherNo);

  if (!voucher?.id) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(241,248,255,0.92))] p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Payment submission
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Voucher {voucher.voucher_no}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            Submit payment details and proof for this voucher. Your submission will be reviewed by the coordinator before LMS access is granted.
          </p>
        </section>

        <PaymentSubmissionForm voucher={voucher} />
      </div>
    </main>
  );
}
