import React from "react";
import { Award, ArrowUpRight, User, Compass } from "lucide-react";
import { type ConversionMetrics } from "@/lib/types/dashboard";

interface ConversionWidgetProps {
  conversion: ConversionMetrics;
}

export function ConversionWidget({ conversion }: ConversionWidgetProps) {
  const topSources = [...conversion.bySource]
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 5);

  const topAssignees = [...conversion.byAssignee]
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Conversion Intelligence</h3>
              <p className="text-xs text-slate-500">Lead-to-customer conversion metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
            <ArrowUpRight className="h-3.5 w-3.5" />
            {conversion.conversionRate}% Rate
          </div>
        </div>

        {/* Summary Metric Numbers */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100 text-center">
            <span className="text-[10px] text-emerald-600 uppercase font-semibold">Converted</span>
            <p className="text-lg font-bold text-emerald-800 mt-0.5">
              {conversion.convertedLeads}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Eligible Leads</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">
              {conversion.totalEligibleLeads}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Formula</span>
            <p className="text-xs font-semibold text-slate-600 mt-1">
              Conv / Eligible
            </p>
          </div>
        </div>

        {/* Top Channels & Assignees */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Source */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <Compass className="h-3 w-3 text-slate-400" />
              Top Channels
            </div>
            {topSources.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No conversions yet</p>
            ) : (
              <div className="space-y-1.5">
                {topSources.map((item) => (
                  <div
                    key={item.source}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700 truncate pr-1">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">{item.converted}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-semibold">
                        {item.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By Assignee */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <User className="h-3 w-3 text-slate-400" />
              Top Performers
            </div>
            {topAssignees.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No conversions yet</p>
            ) : (
              <div className="space-y-1.5">
                {topAssignees.map((item) => (
                  <div
                    key={item.userId}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <span className="font-medium text-slate-700 truncate pr-1">
                      {item.name || item.email}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">{item.converted}</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded font-semibold">
                        {item.rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
