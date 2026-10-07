import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReportsOverview } from "@/features/reports/components/reports-overview";
import { getSession } from "@/lib/auth/server";
import { can } from "@/lib/rbac/permissions";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  // Reports are role-scoped: each role lands on the one report it can run.
  const session = await getSession();
  if (!can(session?.role, "reports.financial")) {
    redirect(can(session?.role, "reports.stock_movement") ? "/reports/stock-movement" : "/reports/shift");
  }
  return <ReportsOverview />;
}
