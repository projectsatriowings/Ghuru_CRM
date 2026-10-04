import React from "react";
import { GitBranch } from "lucide-react";
import { type PipelineMetricItem } from "@/lib/types/dashboard";

interface PipelineWidgetProps {
  pipelines: PipelineMetricItem[];
}

export function PipelineWidget({ pipelines }: PipelineWidgetProps) {
  const totalPipelineLeads = pipelines.reduce(
    (acc, curr) => acc + curr.totalLeads,
    0
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <GitBranch className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pipeline Progression</h3>
            <p className="text-xs text-slate-500">Active leads distributed across configured stages</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {totalPipelineLeads} Leads in Pipelines
        </span>
      </div>

      {pipelines.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No active pipelines configured in this organization.
        </div>
      ) : (
        <div className="space-y-6">
          {pipelines.map((pipe) => (
            <div key={pipe.pipelineId} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  {pipe.pipelineName}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {pipe.totalLeads} total leads
                </span>
              </div>

              {pipe.stages.length === 0 ? (
                <div className="p-3 bg-slate-50 text-slate-400 text-xs rounded-lg text-center">
                  No stages defined for this pipeline.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {pipe.stages.map((st, idx) => (
                    <div
                      key={st.stageId}
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700 truncate" title={st.stageName}>
                          {st.stageName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-lg font-bold text-slate-900">
                          {st.count}
                        </span>
                        <span className="text-xs font-medium text-slate-500">
                          {st.percentage}%
                        </span>
                      </div>
                      <div className="h-1 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full bg-violet-500 rounded-full transition-all duration-300"
                          style={{ width: `${st.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
