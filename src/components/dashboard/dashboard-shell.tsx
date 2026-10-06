"use client";

import React, { useState, useTransition } from "react";
import { DashboardFilters } from "./dashboard-filters";
import { MetricCardsWidget } from "./metric-cards-widget";
import { MyWorkWidget } from "./my-work-widget";
import { NeedsAttentionWidget } from "./needs-attention-widget";
import { LeadStatusWidget } from "./lead-status-widget";
import { FollowUpWidget } from "./follow-up-widget";
import { ActivityWidget } from "./activity-widget";
import { ConversionWidget } from "./conversion-widget";
import { LeadFunnelWidget } from "./lead-funnel-widget";
import { SourcePerformanceWidget } from "./source-performance-widget";
import { PipelineHealthWidget } from "./pipeline-health-widget";
import { PipelineBottleneckWidget } from "./pipeline-bottleneck-widget";
import { PeriodComparisonWidget } from "./period-comparison-widget";
import { UnassignedWorkWidget } from "./unassigned-work-widget";
import { OwnerWorkloadWidget } from "./owner-workload-widget";
import { OwnerComparisonTable } from "./owner-comparison-table";
import { TeamIntelligenceWidget } from "./team-intelligence-widget";
import {
  type DashboardData,
  type DashboardDateRangePreset,
} from "@/lib/types/dashboard";

interface DashboardShellProps {
  initialData: DashboardData;
  members: Array<{ userId: string; name: string; email: string }>;
  pipelines: Array<{ id: string; name: string }>;
  currentUserId: string;
  roleName: string;
}

export function DashboardShell({
  initialData,
  members,
  pipelines,
  currentUserId,
  roleName,
}: DashboardShellProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [preset, setPreset] = useState<DashboardDateRangePreset>(
    initialData.dateRange.preset || "last_30_days"
  );
  const [customFrom, setCustomFrom] = useState<string | undefined>(undefined);
  const [customTo, setCustomTo] = useState<string | undefined>(undefined);
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined);

  const fetchUpdatedData = (params: {
    preset: DashboardDateRangePreset;
    from?: string;
    to?: string;
    assigneeId?: string;
    pipelineId?: string;
  }) => {
    startTransition(async () => {
      try {
        const query = new URLSearchParams();
        if (params.preset) query.set("preset", params.preset);
        if (params.from) query.set("from", params.from);
        if (params.to) query.set("to", params.to);
        if (params.assigneeId) query.set("assigneeId", params.assigneeId);
        if (params.pipelineId) query.set("pipelineId", params.pipelineId);

        const res = await fetch(`/api/v1/dashboard?${query.toString()}`);
        if (!res.ok) {
          throw new Error("Failed to load dashboard data");
        }
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Dashboard refresh error:", err);
      }
    });
  };

  const handleFilterChange = (newFilters: {
    preset: DashboardDateRangePreset;
    from?: string;
    to?: string;
    assigneeId?: string;
    pipelineId?: string;
  }) => {
    setPreset(newFilters.preset);
    setCustomFrom(newFilters.from);
    setCustomTo(newFilters.to);
    setAssigneeId(newFilters.assigneeId);
    setPipelineId(newFilters.pipelineId);

    fetchUpdatedData(newFilters);
  };

  return (
    <div className="space-y-6">
      {/* Reusable Filters Bar */}
      <DashboardFilters
        preset={preset}
        from={customFrom}
        to={customTo}
        assigneeId={assigneeId}
        pipelineId={pipelineId}
        members={members}
        pipelines={pipelines}
        currentUserId={currentUserId}
        onFilterChange={handleFilterChange}
        isLoading={isPending}
      />

      {/* Top Level Metric Cards (Volume, Conversions, Deals, Win Rate) */}
      <MetricCardsWidget
        leads={data.leads}
        followUps={data.followUps}
        activities={data.activities}
        conversion={data.conversion}
        intelligence={data.intelligence}
      />

      {/* Needs Attention (2.10A) and My Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeedsAttentionWidget items={data.needsAttention} />
        <MyWorkWidget myWork={data.myWork} />
      </div>

      {/* Milestone 2.10B: Lead Funnel Intelligence */}
      <LeadFunnelWidget funnel={data.intelligence?.funnel} />

      {/* Milestone 2.10B: Lead Source Performance & Lead Status Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SourcePerformanceWidget sources={data.intelligence?.sources} />
        <LeadStatusWidget metrics={data.leads} />
      </div>

      {/* Milestone 2.10B: Deal Pipeline Health & Intelligence */}
      <PipelineHealthWidget pipelines={data.intelligence?.pipelines} />

      {/* Milestone 2.10B: Pipeline Bottlenecks */}
      <PipelineBottleneckWidget bottlenecks={data.intelligence?.bottlenecks} />

      {/* Milestone 2.10B: Period-over-Period Performance Trend */}
      {data.intelligence?.periodComparison && (
        <PeriodComparisonWidget comparison={data.intelligence.periodComparison} />
      )}

      {/* Detailed Operational Breakdown: Follow-ups, Activities, Conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FollowUpWidget followUps={data.followUps} />
        <ActivityWidget activities={data.activities} />
        <ConversionWidget conversion={data.conversion} />
      </div>

      {/* Milestone 2.10C: Team & Owner Intelligence */}
      {data.teamIntelligence && (
        <div className="space-y-6 pt-2">
          {/* Unassigned Work Alert & Metrics */}
          <UnassignedWorkWidget unassigned={data.teamIntelligence.unassigned} />

          {/* Workload Concentration Indicators */}
          <OwnerWorkloadWidget
            indicators={data.teamIntelligence.indicators}
            owners={data.teamIntelligence.owners}
          />

          {/* Owner Performance & Workload Comparison Table */}
          <OwnerComparisonTable owners={data.teamIntelligence.owners} />

          {/* Team Aggregation & Intelligence */}
          <TeamIntelligenceWidget teams={data.teamIntelligence.teams} />
        </div>
      )}

      {/* Role and Data Context */}
      <div className="pt-2 text-right text-[11px] text-slate-400">
        Workspace view active · Role: {roleName}
      </div>
    </div>
  );
}
