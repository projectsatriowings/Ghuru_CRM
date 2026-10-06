"use client";

import React from "react";
import { Users, Layers, AlertTriangle, Activity, Briefcase } from "lucide-react";
import {
  type WorkloadConcentrationIndicators,
  type OwnerIntelligenceItem,
} from "@/lib/types/team-owner-intelligence";

interface OwnerWorkloadWidgetProps {
  indicators?: WorkloadConcentrationIndicators;
  owners?: OwnerIntelligenceItem[];
}

export function OwnerWorkloadWidget({
  indicators,
  owners = [],
}: OwnerWorkloadWidgetProps) {
  if (!indicators || owners.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Layers className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">Workload Concentration</h3>
          <p className="text-xs text-slate-500">
            Deterministic distribution of leads, deals, follow-ups, and operational activities
          </p>
        </div>
      </div>

      {/* Concentration Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Highest Lead Workload */}
        <div className="p-3.5 rounded-lg border border-slate-200/70 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Most Assigned Leads</span>
            <Users className="h-3.5 w-3.5 text-blue-500" />
          </div>
          {indicators.highestLeadWorkload ? (
            <div>
              <div className="text-base font-bold text-slate-900 truncate">
                {indicators.highestLeadWorkload.name}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-0.5">
                {indicators.highestLeadWorkload.count}{" "}
                {indicators.highestLeadWorkload.count === 1 ? "lead" : "leads"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No assigned leads</div>
          )}
        </div>

        {/* Highest Open Deal Workload */}
        <div className="p-3.5 rounded-lg border border-slate-200/70 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Highest Open Deal Volume</span>
            <Briefcase className="h-3.5 w-3.5 text-violet-500" />
          </div>
          {indicators.highestOpenDealWorkload ? (
            <div>
              <div className="text-base font-bold text-slate-900 truncate">
                {indicators.highestOpenDealWorkload.name}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-0.5">
                {indicators.highestOpenDealWorkload.count}{" "}
                {indicators.highestOpenDealWorkload.count === 1 ? "open deal" : "open deals"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No open deals</div>
          )}
        </div>

        {/* Highest Overdue Workload */}
        <div className="p-3.5 rounded-lg border border-slate-200/70 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Highest Overdue Workload</span>
            <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
          </div>
          {indicators.highestOverdueFollowUps ? (
            <div>
              <div className="text-base font-bold text-slate-900 truncate">
                {indicators.highestOverdueFollowUps.name}
              </div>
              <div className="text-xs text-rose-600 font-semibold mt-0.5">
                {indicators.highestOverdueFollowUps.count}{" "}
                {indicators.highestOverdueFollowUps.count === 1 ? "overdue" : "overdue"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-emerald-600 font-medium">Zero overdue follow-ups</div>
          )}
        </div>

        {/* Highest Operational Activity Volume */}
        <div className="p-3.5 rounded-lg border border-slate-200/70 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-medium">Highest Activity Volume</span>
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          {indicators.highestActivityVolume ? (
            <div>
              <div className="text-base font-bold text-slate-900 truncate">
                {indicators.highestActivityVolume.name}
              </div>
              <div className="text-xs text-slate-600 font-semibold mt-0.5">
                {indicators.highestActivityVolume.count}{" "}
                {indicators.highestActivityVolume.count === 1 ? "activity" : "activities"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No recorded activities</div>
          )}
        </div>
      </div>
    </div>
  );
}
