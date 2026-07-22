import { CloudDashboard } from "@/components/processforge/cloud-dashboard";
import { WorkspaceDashboardSummary } from "@/components/processforge/workspace-dashboard-summary";
import { DashboardAnalyticsSummary } from "@/components/processforge/dashboard-analytics-summary";
export const dynamic = "force-dynamic";
export default function DashboardPage(){ return <><CloudDashboard/><DashboardAnalyticsSummary/><section className="mx-auto -mt-2 max-w-7xl px-4 pb-8 sm:px-6" aria-label="Workspace overview"><WorkspaceDashboardSummary/></section></>; }
