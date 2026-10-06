"use client";

import React from "react";
import { GitBranch, AlertTriangle } from "lucide-react";
import { type PipelineIntelligenceItem } from "@/lib/types/pipeline-intelligence";

interface PipelineHealthWidgetProps {
  pipelines?: PipelineIntelligenceItem[];
}

export function PipelineHealthWidget({ pipelines = [] }: PipelineHealthWidgetProps) {
  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Deal Pipeline Intelligence</h3>
            <p className="text-xs text-slate-500">Pipeline progression, stage health, and outcome rates</p>
          </div>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          No active pipelines available.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Deal Pipeline Intelligence</h3>
            <p className="text-xs text-slate-500">Stage progression, multi-currency open pipeline, and win/loss rates</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {pipelines.length} Active {pipelines.length === 1 ? "Pipeline" : "Pipelines"}
        </span>
      </div>

      {pipelines.map((pipe) => {
        const openCurrencies = Object.entries(pipe.openValueByCurrency || {});
        const wonCurrencies = Object.entries(pipe.wonValueByCurrency || {});

        return (
          <div
            key={pipe.pipelineId}
            className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/30 space-y-4"
          >
            {/* Pipeline Header Ribbon */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{pipe.pipelineName}</span>
                {pipe.isDefault && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    Default
                  </span>
                )}
              </div>

              {/* Deals & Win Rate Ribbon */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span>Open:</span>
                  <strong className="text-slate-900 font-bold">{pipe.openDealCount}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <span>Won:</span>
                  <strong className="font-bold">{pipe.wonDealCount}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-red-600">
                  <span>Lost:</span>
                  <strong className="font-bold">{pipe.lostDealCount}</strong>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1 text-slate-700">
                  <span>Win Rate:</span>
                  <strong className="text-emerald-700 font-bold">{pipe.winRate}%</strong>
                </div>
              </div>
            </div>

            {/* Pipeline Values by Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Open Pipeline Value
                </span>
                {openCurrencies.length === 0 ? (
                  <span className="text-slate-400 font-mono">0.00</span>
                ) : (
                  <div className="space-y-1">
                    {openCurrencies.map(([curr, val]) => (
                      <div key={curr} className="flex items-baseline justify-between font-mono">
                        <span className="font-bold text-slate-700">{curr}</span>
                        <span className="text-sm font-bold text-slate-900">
                          {val.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Won Value
                </span>
                {wonCurrencies.length === 0 ? (
                  <span className="text-slate-400 font-mono">0.00</span>
                ) : (
                  <div className="space-y-1">
                    {wonCurrencies.map(([curr, val]) => (
                      <div key={curr} className="flex items-baseline justify-between font-mono">
                        <span className="font-bold text-emerald-700">{curr}</span>
                        <span className="text-sm font-bold text-emerald-700">
                          {val.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stage Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Stages Breakdown ({pipe.stages.length} Stages)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {pipe.stages.map((st) => {
                  const stageCurrencies = Object.entries(st.openValueByCurrency || {});

                  return (
                    <div
                      key={st.stageId}
                      className={`p-3 rounded-lg border transition-all ${
                        st.isBottleneck
                          ? "border-amber-300 bg-amber-50/30"
                          : "border-slate-100 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-800 truncate" title={st.stageName}>
                          {st.stageName}
                        </span>
                        {st.isBottleneck ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Bottleneck
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">#{st.displayOrder}</span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between mt-1 mb-2">
                        <div className="text-lg font-bold text-slate-900">
                          {st.openDealCount} <span className="text-xs font-normal text-slate-500">open</span>
                        </div>
                        {st.staleDealCount > 0 && (
                          <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                            {st.staleDealCount} stale
                          </span>
                        )}
                      </div>

                      {/* Open Value in Stage */}
                      <div className="pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-600">
                        {stageCurrencies.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <div className="space-y-0.5">
                            {stageCurrencies.map(([curr, val]) => (
                              <div key={curr} className="flex justify-between">
                                <span className="text-slate-400">{curr}</span>
                                <span className="font-semibold text-slate-800">{val.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
