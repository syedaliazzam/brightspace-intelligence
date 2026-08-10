import { requireRole, roleGuardResponse } from "@/lib/roleGuard";
import PlanForMonthClient from "@/components/plan-month/PlanForMonthClient";

export default async function PlanForMonthPage() {
  try {
    // allow student, admin, coordinator and superadmin to view this page
    await requireRole(["student", "admin", "coordinator", "superadmin"]);
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
        <PlanForMonthClient />
      </div>
    </div>
  );
}
