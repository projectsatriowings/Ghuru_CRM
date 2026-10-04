"use client";

import React, { useState, useTransition } from "react";
import { DashboardFilters } from "./dashboard-filters";
import { MetricCardsWidget } from "./metric-cards-widget";
import { MyWorkWidget } from "./my-work-widget";
import { NeedsAttentionWidget } from "./needs-attention-widget";
import { LeadStatusWidget } from "./lead-status-widget";
import { LeadSourceWidget } from "./lead-source-widget";
import { PipelineWidget } from "./pipeline-widget";
import { FollowUpWidget } from "./follow-up-widget";
import { ActivityWidget } from "./activity-widget";
import { ConversionWidget } from "./conversion-widget";
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

  const isAdmin =
    roleName.toLowerCase().includes("admin") ||
    roleName.toLowerCase().includes("manager");

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

      {/* Top Level Metric Cards */}
      <MetricCardsWidget
        leads={data.leads}
        followUps={data.followUps}
        activities={data.activities}
        conversion={data.conversion}
      />

      {/* Role-Aware Grid Ordering:
          For Counsellor/Staff: Operational work (My Work & Needs Attention) is placed first.
          For Admin: Full strategic overview */}
      {isAdmin ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeadStatusWidget metrics={data.leads} />
            <LeadSourceWidget sources={data.sources} />
          </div>
          <PipelineWidget pipelines={data.pipelines} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NeedsAttentionWidget items={data.needsAttention} />
            <MyWorkWidget myWork={data.myWork} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <NeedsAttentionWidget items={data.needsAttention} />
            <MyWorkWidget myWork={data.myWork} />
          </div>
          <PipelineWidget pipelines={data.pipelines} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeadStatusWidget metrics={data.leads} />
            <LeadSourceWidget sources={data.sources} />
          </div>
        </>
      )}

      {/* Detailed Operational Breakdown: Follow-ups, Activities, Conversion */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FollowUpWidget followUps={data.followUps} />
        <ActivityWidget activities={data.activities} />
        <ConversionWidget conversion={data.conversion} />
      </div>
    </div>
  );
}
