"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { type NeedsAttentionItem } from "@/lib/types/dashboard";

interface NeedsAttentionWidgetProps {
  items: NeedsAttentionItem[];
}

export function NeedsAttentionWidget({ items }: NeedsAttentionWidgetProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Needs Attention</h3>
            <p className="text-xs text-slate-500">Critical operational bottlenecks & overdue items</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          items.length > 0 ? "bg-red-50 text-red-700 border border-red-100" : "bg-emerald-50 text-emerald-700"
        }`}>
          {items.length} {items.length === 1 ? "action required" : "actions required"}
        </span>
      </div>

      {/* Item List */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[360px]">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-medium text-slate-800">Clear queue!</p>
            <p className="text-xs text-slate-400 mt-0.5">
              No overdue follow-ups, past due tasks, or stalled leads detected.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => {
              const isHigh = item.urgency === "high";
              return (
                <Link
                  key={item.id}
                  href={item.link}
                  className={`group block p-3 rounded-lg border transition-all ${
                    isHigh
                      ? "border-red-200/70 bg-red-50/30 hover:bg-red-50/70"
                      : "border-amber-200/70 bg-amber-50/30 hover:bg-amber-50/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            isHigh ? "text-red-700" : "text-amber-800"
                          }`}
                        >
                          {item.title}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                            isHigh
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                        {item.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-medium text-slate-700">
                          {item.entityName}
                        </span>
                        <span>•</span>
                        <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ArrowRight
                      className={`h-4 w-4 shrink-0 mt-0.5 transition-colors ${
                        isHigh
                          ? "text-red-400 group-hover:text-red-700"
                          : "text-amber-400 group-hover:text-amber-700"
                      }`}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
