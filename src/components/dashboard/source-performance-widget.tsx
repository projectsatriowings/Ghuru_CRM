"use client";

import React, { useState } from "react";
import { Share2 } from "lucide-react";
import { type SourcePerformanceItem } from "@/lib/types/pipeline-intelligence";

interface SourcePerformanceWidgetProps {
  sources?: SourcePerformanceItem[];
}

type SortField = "leads" | "qualification" | "conversion" | "won";

export function SourcePerformanceWidget({ sources = [] }: SourcePerformanceWidgetProps) {
  const [sortField, setSortField] = useState<SortField>("leads");

  if (!sources || sources.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Share2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Lead Source Performance</h3>
            <p className="text-xs text-slate-500">Acquisition channel quality vs volume</p>
          </div>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          No acquisition source data available for this period.
        </div>
      </div>
    );
  }

  const sortedSources = [...sources].sort((a, b) => {
    if (sortField === "leads") return b.leadCount - a.leadCount;
    if (sortField === "qualification") return b.qualificationRate - a.qualificationRate;
    if (sortField === "conversion") return b.conversionRate - a.conversionRate;
    if (sortField === "won") return b.dealsWonCount - a.dealsWonCount;
    return 0;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header with Sort Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Lead Source Performance</h3>
              <p className="text-xs text-slate-500">Volume ≠ Quality: Compare qualification and conversion rates</p>
            </div>
          </div>

          {/* Sort Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSortField("leads")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                sortField === "leads"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Volume
            </button>
            <button
              type="button"
              onClick={() => setSortField("qualification")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                sortField === "qualification"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Qualified %
            </button>
            <button
              type="button"
              onClick={() => setSortField("conversion")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                sortField === "conversion"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Converted %
            </button>
            <button
              type="button"
              onClick={() => setSortField("won")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                sortField === "won"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Deals Won
            </button>
          </div>
        </div>

        {/* Source Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Source Channel</th>
                <th className="py-2.5 px-3 text-right">Lead Volume</th>
                <th className="py-2.5 px-3 text-right">Qualified</th>
                <th className="py-2.5 px-3 text-right">Converted</th>
                <th className="py-2.5 px-3 text-right">Deals Won</th>
                <th className="py-2.5 px-3 text-right">Won Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedSources.map((s) => {
                const wonCurrencies = Object.entries(s.wonValueByCurrency || {});
                return (
                  <tr key={s.source} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-800">
                      {s.label}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {s.leadCount}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-semibold text-amber-700">{s.qualificationRate}%</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        ({s.qualifiedCount} / {s.leadCount})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-semibold text-emerald-700">{s.conversionRate}%</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        ({s.convertedCount} / {s.leadCount})
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-slate-800">{s.dealsWonCount}</span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        ({s.winRate}% win)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                      {wonCurrencies.length === 0 ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {wonCurrencies.map(([curr, val]) => (
                            <div key={curr} className="text-emerald-700 font-semibold">
                              {curr} {val.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
        <span>Attribution links deals created from cohort leads</span>
        <span>Sample sizes displayed alongside conversion rates</span>
      </div>
    </div>
  );
}
