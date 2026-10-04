import React from "react";
import { Layers } from "lucide-react";
import { type LeadMetrics } from "@/lib/types/dashboard";
import { type LeadStatus } from "@/lib/types/leads";

interface LeadStatusWidgetProps {
  metrics: LeadMetrics;
}

const STATUS_COLORS: Record<LeadStatus, { bg: string; text: string }> = {
  new: { bg: "bg-blue-500", text: "text-blue-700" },
  contacted: { bg: "bg-indigo-500", text: "text-indigo-700" },
  qualified: { bg: "bg-amber-500", text: "text-amber-700" },
  unqualified: { bg: "bg-slate-400", text: "text-slate-600" },
  converted: { bg: "bg-emerald-500", text: "text-emerald-700" },
  lost: { bg: "bg-red-400", text: "text-red-600" },
};

export function LeadStatusWidget({ metrics }: LeadStatusWidgetProps) {
  const activeLeadsCount =
    metrics.new + metrics.contacted + metrics.qualified;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lead Status Funnel</h3>
              <p className="text-xs text-slate-500">Distribution across active lead lifecycle</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            {metrics.total} In Range
          </span>
        </div>

        {/* Stacked Progress Bar */}
        <div className="h-3 w-full bg-slate-100 rounded-full flex overflow-hidden mb-5">
          {metrics.statusBreakdown.map((st) => {
            const color = STATUS_COLORS[st.status]?.bg || "bg-slate-300";
            return st.percentage > 0 ? (
              <div
                key={st.status}
                style={{ width: `${st.percentage}%` }}
                className={`${color} transition-all duration-300`}
                title={`${st.label}: ${st.count} (${st.percentage}%)`}
              />
            ) : null;
          })}
        </div>

        {/* Individual Status Rows */}
        <div className="space-y-3">
          {metrics.statusBreakdown.map((st) => {
            const color = STATUS_COLORS[st.status]?.bg || "bg-slate-300";
            return (
              <div key={st.status} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    {st.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{st.count}</span>
                    <span className="text-slate-400 text-[11px] w-10 text-right">
                      {st.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} rounded-full transition-all duration-300`}
                    style={{ width: `${st.percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Active Pipeline Leads: <strong className="text-slate-800">{activeLeadsCount}</strong></span>
        <span>Converted Leads: <strong className="text-emerald-700 font-bold">{metrics.converted}</strong></span>
      </div>
    </div>
  );
}
