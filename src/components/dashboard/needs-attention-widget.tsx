"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import { type NeedsAttentionItem } from "@/lib/types/dashboard";
import { SeverityBadge } from "@/components/intelligence/health-status-badge";
import { type IntelligenceSeverity } from "@/lib/types/intelligence";

interface NeedsAttentionWidgetProps {
  items: NeedsAttentionItem[];
}

type FilterTab = "all" | "critical_high" | "medium_low" | "deals" | "leads";

export function NeedsAttentionWidget({ items }: NeedsAttentionWidgetProps) {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filteredItems = items.filter((item) => {
    const isCriticalOrHigh = item.urgency === "critical" || item.urgency === "high";
    const isMediumOrLow = item.urgency === "medium" || item.urgency === "low";

    switch (filter) {
      case "critical_high":
        return isCriticalOrHigh;
      case "medium_low":
        return isMediumOrLow;
      case "deals":
        return item.entityType === "deal";
      case "leads":
        return item.entityType === "lead";
      case "all":
      default:
        return true;
    }
  });

  const highCriticalCount = items.filter(
    (i) => i.urgency === "critical" || i.urgency === "high"
  ).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              highCriticalCount > 0
                ? "bg-rose-50 text-rose-600"
                : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Needs Attention</h3>
            <p className="text-xs text-slate-500">
              Operational bottlenecks, stale entities & overdue follow-ups
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full self-start sm:self-auto ${
            highCriticalCount > 0
              ? "bg-rose-50 text-rose-700 border border-rose-100"
              : items.length > 0
              ? "bg-amber-50 text-amber-800 border border-amber-100"
              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          }`}
        >
          {items.length} {items.length === 1 ? "item requires action" : "items require action"}
        </span>
      </div>

      {/* Filter Tabs */}
      {items.length > 0 && (
        <div className="px-5 pt-3 pb-2 border-b border-slate-100 bg-slate-50/40 flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "all"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("critical_high")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "critical_high"
                ? "bg-white text-rose-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-rose-600"
            }`}
          >
            High & Critical ({highCriticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("deals")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "deals"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Deals ({items.filter((i) => i.entityType === "deal").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("leads")}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === "leads"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Leads ({items.filter((i) => i.entityType === "lead").length})
          </button>
        </div>
      )}

      {/* Item List */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[420px]">
        {filteredItems.length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500 mx-auto mb-2 opacity-90" />
            <p className="text-sm font-semibold text-slate-800">
              Everything looks healthy!
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              There&apos;s nothing urgent requiring attention in this view right now.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const isCritical = item.urgency === "critical";
              const isHigh = item.urgency === "high";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCritical
                      ? "border-rose-200/90 bg-rose-50/30 hover:bg-rose-50/60"
                      : isHigh
                      ? "border-red-200/80 bg-red-50/30 hover:bg-red-50/60"
                      : "border-slate-200/80 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Badges row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <SeverityBadge
                          severity={item.urgency as IntelligenceSeverity}
                          size="xs"
                        />
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.entityType}
                        </span>
                        {item.value !== undefined && item.value !== null && (
                          <span className="text-[11px] font-bold text-slate-900 font-mono">
                            {item.currency || "$"} {Number(item.value).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Title & Entity Name */}
                      <div className="mt-1.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {item.entityName}
                        </h4>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Recommended Action */}
                      {item.recommendedAction && (
                        <div className="mt-2 text-[11px] text-blue-900 bg-blue-50/70 border border-blue-200/60 rounded-md p-1.5 flex items-center gap-1.5">
                          <Lightbulb className="h-3 w-3 text-blue-600 shrink-0" />
                          <span className="font-medium truncate">
                            {item.recommendedAction}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* View Button */}
                    <Link
                      href={item.link}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 shadow-2xs shrink-0 self-center"
                    >
                      <span>View</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
