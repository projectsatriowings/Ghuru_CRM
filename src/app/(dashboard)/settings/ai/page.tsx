import { requireOrganization } from "@/lib/context/organization-context";
import {
  getAIGovernanceSummary,
  getOrganizationAIAuditLogsPaginated,
} from "@/lib/services/ai/ai-governance.service";
import { AIGovernanceView } from "@/components/settings/ai-governance/ai-governance-view";
import { ForbiddenError } from "@/lib/errors";

export const metadata = {
  title: "AI Governance - Ghuru CRM",
  description: "Operational AI Governance, Usage Telemetry, and Audit Administration",
};

export default async function AIGovernancePage() {
  const ctx = await requireOrganization();

  if (!ctx.hasPermission("ai_governance.view")) {
    throw new ForbiddenError(
      "Forbidden: You do not have the required permission [ai_governance.view] to view AI governance settings."
    );
  }

  const canManage = ctx.hasPermission("ai_governance.manage");

  const [summary, auditLogs] = await Promise.all([
    getAIGovernanceSummary(ctx.organization.id),
    getOrganizationAIAuditLogsPaginated(ctx.organization.id, {
      page: 1,
      pageSize: 25,
    }),
  ]);

  return (
    <AIGovernanceView
      initialSummary={summary}
      initialAuditLogs={auditLogs}
      canManage={canManage}
    />
  );
}
