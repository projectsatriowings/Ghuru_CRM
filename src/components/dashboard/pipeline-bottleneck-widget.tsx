"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { type PipelineBottleneckItem } from "@/lib/types/pipeline-intelligence";

interface PipelineBottleneckWidgetProps {
  bottlenecks?: PipelineBottleneckItem[];
}

export function PipelineBottleneckWidget({ bottlenecks = [] }: PipelineBottleneckWidgetProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pipeline Bottlenecks</h3>
            <p className="text-xs text-slate-500">Deterministic bottleneck detection with explainable cause</p>
          </div>
        </div>
        {bottlenecks.length > 0 ? (
          <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2.5 py-0.5 rounded-full">
            {bottlenecks.length} {bottlenecks.length === 1 ? "Bottleneck Detected" : "Bottlenecks Detected"}
          </span>
        ) : (
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Normal Deal Flow
          </span>
        )}
      </div>

      {bottlenecks.length === 0 ? (
        <div className="py-6 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-slate-700">No Stage Bottlenecks Detected</p>
          <p className="text-[11px] text-slate-400 max-w-md mx-auto mt-0.5">
            Open deals and deal velocity are well-balanced across active stages. No abnormal stagnation or single-stage congestion found.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bottlenecks.map((b) => {
            const openCurrencies = Object.entries(b.openValueByCurrency || {});

            return (
              <div
                key={`${b.pipelineId}:${b.stageId}`}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Stage & Pipeline Title */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {b.stageName}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {b.pipelineName}
                    </span>
                  </div>

                  {/* Volume & Values */}
                  <div className="flex items-baseline gap-4 mb-2.5">
                    <div>
                      <span className="text-lg font-bold text-slate-900">{b.openDealCount}</span>
                      <span className="text-xs text-slate-500 ml-1">open deals</span>
                    </div>
                    {b.staleDealCount > 0 && (
                      <div className="text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded">
                        {b.staleDealCount} stale (14+ days)
                      </div>
                    )}
                  </div>

                  {/* Open Value by Currency */}
                  {openCurrencies.length > 0 && (
                    <div className="text-xs font-mono text-slate-700 mb-2">
                      <span className="text-[11px] text-slate-400 block mb-0.5">Open Value:</span>
                      {openCurrencies.map(([curr, val]) => (
                        <span key={curr} className="inline-block mr-3 font-semibold">
                          {curr} {val.toLocaleString()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Why this is a bottleneck */}
                  <div className="p-2.5 bg-white/80 rounded-lg border border-amber-100 text-xs space-y-1">
                    <div className="font-semibold text-amber-900 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                      Reason:
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {b.reason}
                    </p>
                  </div>
                </div>

                {/* Recommendation & View Link */}
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 italic truncate max-w-[70%]" title={b.recommendation}>
                    💡 {b.recommendation}
                  </span>
                  <Link
                    href={`/deals?pipelineId=${b.pipelineId}`}
                    className="text-xs font-semibold text-amber-800 hover:text-amber-900 flex items-center gap-1 shrink-0"
                  >
                    View Pipeline <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
