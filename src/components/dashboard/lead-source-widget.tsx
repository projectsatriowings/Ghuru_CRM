import React from "react";
import { Compass } from "lucide-react";
import { type LeadSourceMetricItem } from "@/lib/types/dashboard";

interface LeadSourceWidgetProps {
  sources: LeadSourceMetricItem[];
}

export function LeadSourceWidget({ sources }: LeadSourceWidgetProps) {
  // Sort descending by count
  const sorted = [...sources].sort((a, b) => b.count - a.count);
  const totalLeads = sorted.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Leads by Acquisition Source</h3>
              <p className="text-xs text-slate-500">Channel breakdown for generated leads</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            {sources.length} Channels
          </span>
        </div>

        {sorted.length === 0 || totalLeads === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No source data recorded for this date range.
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => (
              <div key={item.source} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 text-[11px] w-10 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Total Channel Leads: <strong className="text-slate-800">{totalLeads}</strong></span>
        <span>Top Source: <strong className="text-slate-800">{sorted[0]?.label || "N/A"}</strong></span>
      </div>
    </div>
  );
}
