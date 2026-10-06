"use client";

import React from "react";
import { Filter, Info } from "lucide-react";
import { type LeadFunnelMetrics } from "@/lib/types/pipeline-intelligence";

interface LeadFunnelWidgetProps {
  funnel?: LeadFunnelMetrics;
}

export function LeadFunnelWidget({ funnel }: LeadFunnelWidgetProps) {
  if (!funnel || funnel.totalLeads === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lead Funnel Intelligence</h3>
            <p className="text-xs text-slate-500">Funnel progression and step conversion rates</p>
          </div>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          No lead data available for the selected period.
        </div>
      </div>
    );
  }

  const {
    totalLeads,
    newCount,
    contactedCount,
    qualifiedCount,
    convertedCount,
    lostCount,
    unqualifiedCount,
    qualificationRate,
    conversionRate,
    transitions,
    historicalDataNote,
  } = funnel;

  const qualifiedTotal = qualifiedCount + convertedCount;

  const funnelSteps = [
    {
      name: "Total Leads",
      count: totalLeads,
      percent: 100,
      color: "bg-blue-500",
      textColor: "text-blue-700",
      subtext: "Inflow into funnel",
    },
    {
      name: "Contacted",
      count: totalLeads - newCount,
      percent: transitions.leadToContactedRate,
      color: "bg-indigo-500",
      textColor: "text-indigo-700",
      subtext: `${transitions.leadToContactedRate}% of total`,
    },
    {
      name: "Qualified",
      count: qualifiedTotal,
      percent: transitions.contactedToQualifiedRate,
      color: "bg-amber-500",
      textColor: "text-amber-700",
      subtext: `${transitions.contactedToQualifiedRate}% of contacted`,
    },
    {
      name: "Converted",
      count: convertedCount,
      percent: transitions.qualifiedToConvertedRate,
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      subtext: `${transitions.qualifiedToConvertedRate}% of qualified`,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lead Funnel Intelligence</h3>
              <p className="text-xs text-slate-500">Deterministic funnel progression and transition efficiency</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
              {qualificationRate}% Qualified
            </span>
            <span className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full">
              {conversionRate}% Converted
            </span>
          </div>
        </div>

        {/* Funnel Stepped Visualization */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {funnelSteps.map((step, idx) => (
            <div
              key={step.name}
              className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">{step.name}</span>
                <span className="text-[10px] font-mono text-slate-400">Step {idx + 1}</span>
              </div>
              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900">{step.count}</span>
                <span className={`text-xs font-bold ${step.textColor}`}>
                  {step.percent}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full ${step.color} rounded-full transition-all duration-300`}
                  style={{ width: `${Math.min(100, step.percent)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-1.5 truncate">{step.subtext}</span>
            </div>
          ))}
        </div>

        {/* Transition Rates Ribbon */}
        <div className="p-3 rounded-lg bg-slate-50/80 border border-slate-100 mb-4">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
            Funnel Transition Rates
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Lead → Contacted</div>
              <div className="text-sm font-bold text-slate-800">{transitions.leadToContactedRate}%</div>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Contacted → Qualified</div>
              <div className="text-sm font-bold text-slate-800">{transitions.contactedToQualifiedRate}%</div>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Qualified → Converted</div>
              <div className="text-sm font-bold text-slate-800">{transitions.qualifiedToConvertedRate}%</div>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Converted → Deal</div>
              <div className="text-sm font-bold text-slate-800">{transitions.convertedToDealRate}%</div>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Deal → Won</div>
              <div className="text-sm font-bold text-slate-800">{transitions.dealToWonRate}%</div>
            </div>
            <div className="p-2 bg-white rounded-md border border-slate-100">
              <div className="text-[10px] text-slate-500">Lead → Won</div>
              <div className="text-sm font-bold text-emerald-700">{transitions.overallLeadToWonRate}%</div>
            </div>
          </div>
        </div>

        {/* Current Status Breakdown Bar */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Status Distribution ({totalLeads} total leads)</span>
            <span>
              Contacted: <strong className="text-slate-700">{contactedCount}</strong> · Unqualified: <strong className="text-slate-700">{unqualifiedCount}</strong> · Lost: <strong className="text-slate-700">{lostCount}</strong>
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
            {funnel.stages.map((st) => (
              st.percentage > 0 ? (
                <div
                  key={st.status}
                  style={{ width: `${st.percentage}%` }}
                  className={`h-full transition-all duration-300 ${
                    st.status === "new" ? "bg-blue-400" :
                    st.status === "contacted" ? "bg-indigo-400" :
                    st.status === "qualified" ? "bg-amber-400" :
                    st.status === "converted" ? "bg-emerald-500" :
                    st.status === "unqualified" ? "bg-slate-300" : "bg-red-300"
                  }`}
                  title={`${st.label}: ${st.count} (${st.percentage}%)`}
                />
              ) : null
            ))}
          </div>
        </div>
      </div>

      {/* Historical Data Limitation Note */}
      {historicalDataNote && (
        <div className="mt-2 pt-2.5 border-t border-slate-100 flex items-start gap-1.5 text-[11px] text-slate-400">
          <Info className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
          <span>{historicalDataNote}</span>
        </div>
      )}
    </div>
  );
}
