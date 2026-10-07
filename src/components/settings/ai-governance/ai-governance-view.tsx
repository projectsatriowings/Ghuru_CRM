"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIStatusCard } from "./ai-status-card";
import { AIUsageMetrics } from "./ai-usage-metrics";
import { AILimitsForm } from "./ai-limits-form";
import { AIErrorBreakdown } from "./ai-error-breakdown";
import { AIEndpointUsageTable } from "./ai-endpoint-usage-table";
import { AIUserUsageTable } from "./ai-user-usage-table";
import { AIAuditLogTable } from "./ai-audit-log-table";
import { AIGovernanceSummary, PaginatedAIAuditLogs } from "@/lib/types/ai-governance";
import { Activity, FileText, BarChart3 } from "lucide-react";

interface AIGovernanceViewProps {
  initialSummary: AIGovernanceSummary;
  initialAuditLogs?: PaginatedAIAuditLogs;
  canManage: boolean;
}

export function AIGovernanceView({
  initialSummary,
  initialAuditLogs,
  canManage,
}: AIGovernanceViewProps) {
  const [summary, setSummary] = useState<AIGovernanceSummary>(initialSummary);

  const handleSettingsUpdated = (updated: {
    aiEnabled: boolean;
    dailyRequestLimit: number;
    monthlyRequestLimit: number;
  }) => {
    setSummary((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...updated,
      },
      providerStatus: {
        ...prev.providerStatus,
        availability: updated.aiEnabled
          ? prev.providerStatus.isConfigured
            ? "available"
            : "not_configured"
          : "disabled",
      },
      usage: {
        ...prev.usage,
        dailyUsage: {
          ...prev.usage.dailyUsage,
          limit: updated.dailyRequestLimit,
          remaining: Math.max(0, updated.dailyRequestLimit - prev.usage.dailyUsage.used),
          percentage:
            updated.dailyRequestLimit > 0
              ? Math.min(100, Math.round((prev.usage.dailyUsage.used / updated.dailyRequestLimit) * 100))
              : 0,
        },
        monthlyUsage: {
          ...prev.usage.monthlyUsage,
          limit: updated.monthlyRequestLimit,
          remaining: Math.max(0, updated.monthlyRequestLimit - prev.usage.monthlyUsage.used),
          percentage:
            updated.monthlyRequestLimit > 0
              ? Math.min(100, Math.round((prev.usage.monthlyUsage.used / updated.monthlyRequestLimit) * 100))
              : 0,
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            AI Governance & Quota Administration
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time operational transparency, durable audit trail, and workspace policy enforcement
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="overview" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <Activity className="h-3.5 w-3.5" />
            <span>Overview & Quotas</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <FileText className="h-3.5 w-3.5" />
            <span>Audit Log</span>
          </TabsTrigger>
          <TabsTrigger value="breakdown" className="text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Capacity Breakdown</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & LIMITS */}
        <TabsContent value="overview" className="space-y-6">
          <AIStatusCard status={summary.providerStatus} />
          <AIUsageMetrics usage={summary.usage} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AILimitsForm
              initialSettings={summary.settings}
              canManage={canManage}
              onSettingsUpdated={handleSettingsUpdated}
            />
            <AIErrorBreakdown errors={summary.errors} />
          </div>
        </TabsContent>

        {/* TAB 2: AUDIT LOG */}
        <TabsContent value="audit" className="space-y-6">
          <AIAuditLogTable initialData={initialAuditLogs} />
        </TabsContent>

        {/* TAB 3: BREAKDOWN */}
        <TabsContent value="breakdown" className="space-y-6">
          <AIEndpointUsageTable endpoints={summary.endpointUsage} />
          <AIUserUsageTable users={summary.userUsage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
