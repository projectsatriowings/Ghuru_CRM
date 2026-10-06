"use client";

import React from "react";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Calendar } from "lucide-react";
import { type PeriodComparisonData } from "@/lib/types/pipeline-intelligence";

interface PeriodComparisonWidgetProps {
  comparison?: PeriodComparisonData;
}

export function PeriodComparisonWidget({ comparison }: PeriodComparisonWidgetProps) {
  if (!comparison) {
    return null;
  }

  const {
    currentPeriod,
    previousPeriod,
    leads,
    qualifiedLeads,
    convertedLeads,
    dealsCreated,
    dealsWon,
    wonValue,
  } = comparison;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return isoStr;
    }
  };

  const renderBadge = (change: number | null) => {
    if (change === null) return <span className="text-slate-400 font-mono">—</span>;
    if (change === 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          <Minus className="h-3 w-3" /> 0.0%
        </span>
      );
    }
    const isUp = change > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
          isUp
            ? "text-emerald-800 bg-emerald-50 border border-emerald-200/60"
            : "text-red-800 bg-red-50 border border-red-200/60"
        }`}
      >
        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {isUp ? `+${change}%` : `${change}%`}
      </span>
    );
  };

  const metrics = [
    { label: "Leads Created", item: leads },
    { label: "Qualified Leads", item: qualifiedLeads },
    { label: "Converted Leads", item: convertedLeads },
    { label: "Deals Created", item: dealsCreated },
    { label: "Deals Won", item: dealsWon },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header with Date Boundaries */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Period-over-Period Performance</h3>
            <p className="text-xs text-slate-500">Comparison against previous equivalent time window</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg self-start sm:self-auto">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {formatDate(currentPeriod.from)} - {formatDate(currentPeriod.to)}
          </span>
          <span className="text-slate-300">vs</span>
          <span className="text-slate-400">
            {formatDate(previousPeriod.from)} - {formatDate(previousPeriod.to)}
          </span>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map(({ label, item }) => (
          <div
            key={label}
            className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
          >
            <span className="text-xs font-semibold text-slate-600 truncate">{label}</span>
            <div className="my-2 flex items-baseline justify-between">
              <span className="text-xl font-bold text-slate-900">{item.current}</span>
              {renderBadge(item.changePercentage)}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>Prior:</span>
              <strong className="text-slate-600 font-semibold">{item.previous}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Won Value Comparisons by Currency */}
      {wonValue.length > 0 && (
        <div className="pt-3 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 block mb-2">
            Won Value Progression
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {wonValue.map((wv) => (
              <div
                key={wv.currency}
                className="p-3 rounded-lg border border-slate-100 bg-white flex items-center justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    {wv.currency} Won Value
                  </span>
                  <div className="text-base font-bold text-emerald-700 font-mono">
                    {wv.currency} {wv.current.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Prior: {wv.previous.toLocaleString()}
                  </span>
                </div>
                {renderBadge(wv.changePercentage)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
