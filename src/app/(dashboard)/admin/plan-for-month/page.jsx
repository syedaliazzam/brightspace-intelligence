import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import PlanForMonthClient from "@/components/plan-month/PlanForMonthClient";

export default async function AdminPlanForMonthPage() {
  try {
    await requireRole(["admin"]);
  } catch (err) {
    const guardResp = roleGuardResponse(err);
    if (guardResp) return (
      <div className="p-6">
        <p className="text-red-600">{guardResp.body?.message || "Unauthorized"}</p>
      </div>
    );
    return (
      <div className="p-6">
        <p className="text-red-600">Forbidden</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#FAF7F0]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,162,39,0.12),transparent_35%),radial-gradient(circle_at_top_right,rgba(45,138,106,0.12),transparent_32%),linear-gradient(180deg,#FAF7F0_0%,#F7F1E3_100%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-[#2D8A6A]/15 bg-[linear-gradient(135deg,rgba(13,59,46,0.98),rgba(13,92,72,0.94))] p-6 text-[#FAF7F0] shadow-[0_24px_80px_-36px_rgba(13,59,46,0.32)] sm:p-8">
          <div className="relative flex flex-col gap-0">
            <p className="inline-flex w-fit rounded-full border border-[#E4C766]/30 bg-[#FFF5D6]/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#FFF5D6]">Admin portal</p>
            <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-[#FAF7F0] sm:text-4xl">Monthly plan manager</h1>
            <p className="mt-3 text-sm leading-7 text-[#EAF6EF] sm:text-base">Create and manage monthly plans. Admins can edit and upload plan images from this page.</p>
          </div>
        </section>

        <div className="relative mx-auto max-w-7xl">
          <PlanForMonthClient canCreate={true} />
        </div>
      </div>
    </div>
  );
}
