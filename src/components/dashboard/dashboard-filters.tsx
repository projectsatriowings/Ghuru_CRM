"use client";

import React, { useState } from "react";
import { Calendar, User, GitBranch, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type DashboardDateRangePreset,
} from "@/lib/types/dashboard";
import { DATE_RANGE_PRESET_LABELS } from "@/lib/utils/date-range-utils";

export interface DashboardFiltersProps {
  preset: DashboardDateRangePreset;
  from?: string;
  to?: string;
  assigneeId?: string;
  pipelineId?: string;
  members: Array<{ userId: string; name: string; email: string }>;
  pipelines: Array<{ id: string; name: string }>;
  currentUserId: string;
  onFilterChange: (filters: {
    preset: DashboardDateRangePreset;
    from?: string;
    to?: string;
    assigneeId?: string;
    pipelineId?: string;
  }) => void;
  isLoading?: boolean;
}

export function DashboardFilters({
  preset,
  from,
  to,
  assigneeId,
  pipelineId,
  members,
  pipelines,
  currentUserId,
  onFilterChange,
  isLoading,
}: DashboardFiltersProps) {
  const [selectedPreset, setSelectedPreset] = useState<DashboardDateRangePreset>(preset);
  const [customFrom, setCustomFrom] = useState(from || "");
  const [customTo, setCustomTo] = useState(to || "");
  const [selectedAssignee, setSelectedAssignee] = useState(assigneeId || "all");
  const [selectedPipeline, setSelectedPipeline] = useState(pipelineId || "all");

  const handlePresetChange = (newPreset: DashboardDateRangePreset) => {
    setSelectedPreset(newPreset);
    if (newPreset !== "custom") {
      onFilterChange({
        preset: newPreset,
        assigneeId: selectedAssignee === "all" ? undefined : selectedAssignee,
        pipelineId: selectedPipeline === "all" ? undefined : selectedPipeline,
      });
    }
  };

  const handleApplyCustomDates = () => {
    if (customFrom && customTo) {
      onFilterChange({
        preset: "custom",
        from: customFrom,
        to: customTo,
        assigneeId: selectedAssignee === "all" ? undefined : selectedAssignee,
        pipelineId: selectedPipeline === "all" ? undefined : selectedPipeline,
      });
    }
  };

  const handleAssigneeChange = (val: string) => {
    setSelectedAssignee(val);
    onFilterChange({
      preset: selectedPreset,
      from: selectedPreset === "custom" ? customFrom : undefined,
      to: selectedPreset === "custom" ? customTo : undefined,
      assigneeId: val === "all" ? undefined : val,
      pipelineId: selectedPipeline === "all" ? undefined : selectedPipeline,
    });
  };

  const handlePipelineChange = (val: string) => {
    setSelectedPipeline(val);
    onFilterChange({
      preset: selectedPreset,
      from: selectedPreset === "custom" ? customFrom : undefined,
      to: selectedPreset === "custom" ? customTo : undefined,
      assigneeId: selectedAssignee === "all" ? undefined : selectedAssignee,
      pipelineId: val === "all" ? undefined : val,
    });
  };

  const handleReset = () => {
    setSelectedPreset("last_30_days");
    setCustomFrom("");
    setCustomTo("");
    setSelectedAssignee("all");
    setSelectedPipeline("all");
    onFilterChange({
      preset: "last_30_days",
      assigneeId: undefined,
      pipelineId: undefined,
    });
  };

  const isFiltered =
    selectedPreset !== "last_30_days" ||
    selectedAssignee !== "all" ||
    selectedPipeline !== "all";

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedPreset}
              onChange={(e) =>
                handlePresetChange(e.target.value as DashboardDateRangePreset)
              }
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer text-xs"
              disabled={isLoading}
            >
              {(Object.keys(DATE_RANGE_PRESET_LABELS) as DashboardDateRangePreset[]).map(
                (pKey) => (
                  <option key={pKey} value={pKey}>
                    {DATE_RANGE_PRESET_LABELS[pKey]}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Custom Date Inputs (when custom selected) */}
          {selectedPreset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyCustomDates}
                disabled={!customFrom || !customTo || isLoading}
                className="text-xs h-7 px-2.5"
              >
                Apply
              </Button>
            </div>
          )}

          {/* Assignee Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs">
            <User className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedAssignee}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer text-xs max-w-[150px] truncate"
              disabled={isLoading}
            >
              <option value="all">All Assignees</option>
              {currentUserId && (
                <option value={currentUserId}>Assigned to Me</option>
              )}
              {members
                .filter((m) => m.userId !== currentUserId)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email}
                  </option>
                ))}
            </select>
          </div>

          {/* Pipeline Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5 text-xs">
            <GitBranch className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <select
              value={selectedPipeline}
              onChange={(e) => handlePipelineChange(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer text-xs max-w-[150px] truncate"
              disabled={isLoading}
            >
              <option value="all">All Pipelines</option>
              {pipelines.map((pipe) => (
                <option key={pipe.id} value={pipe.id}>
                  {pipe.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Reset & Status */}
        <div className="flex items-center gap-2">
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="h-8 text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
          {isLoading && (
            <span className="text-xs text-slate-400 animate-pulse">
              Updating metrics...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
