"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AIBriefingResult } from "@/lib/types/ai";
import { type DashboardDateRangePreset } from "@/lib/types/dashboard";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";

interface AIBriefingWidgetProps {
  preset?: DashboardDateRangePreset | string;
  from?: string;
  to?: string;
  assigneeId?: string;
  pipelineId?: string;
  onBriefingLoaded?: (data: AIBriefingResult) => void;
}

export function AIBriefingWidget({
  preset,
  from,
  to,
  assigneeId,
  pipelineId,
  onBriefingLoaded,
}: AIBriefingWidgetProps) {
  const [briefing, setBriefing] = useState<AIBriefingResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (preset) query.set("preset", preset);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (assigneeId) query.set("assigneeId", assigneeId);
      if (pipelineId) query.set("pipelineId", pipelineId);
      if (forceRefresh) query.set("forceRefresh", "true");

      const res = await fetch(`/api/v1/intelligence/ai/briefing?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json.error?.message || "Failed to load operational AI briefing."
        );
      }

      setBriefing(json.data);
      if (onBriefingLoaded) {
        onBriefingLoaded(json.data);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI insights are temporarily unavailable. Your CRM data and dashboard remain fully operational."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500 text-white hover:bg-red-600 text-[10px]">Critical</Badge>;
      case "high":
        return <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-[10px]">High</Badge>;
      case "medium":
        return <Badge className="bg-blue-500 text-white hover:bg-blue-600 text-[10px]">Medium</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Low</Badge>;
    }
  };

  return (
    <Card className="border-indigo-100/80 shadow-xs overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-indigo-50/50 via-white to-sky-50/30 pb-4 border-b border-indigo-50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  AI Daily Operational Briefing
                </CardTitle>
                <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-white">
                  AI Interpretation
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Executive CRM digest grounded in active pipelines, health signals, and owner workload
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={briefing ? "outline" : "default"}
              onClick={() => fetchBriefing(Boolean(briefing))}
              disabled={isLoading}
              className={
                briefing
                  ? "text-xs border-indigo-200 hover:bg-indigo-50"
                  : "text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`}
              />
              {isLoading
                ? "Synthesizing..."
                : briefing
                ? "Refresh Briefing"
                : "Generate AI Briefing"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* State 1: Not yet requested */}
        {!briefing && !isLoading && !error && (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h4 className="text-sm font-semibold text-slate-800">
                On-Demand Operational Intelligence
              </h4>
              <p className="text-xs text-slate-500">
                Generate an instant briefing synthesizing high-priority overdue follow-ups,
                pipeline bottlenecks, unassigned workload, and period-over-period movements.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => fetchBriefing(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-4"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Generate Daily Briefing
            </Button>
          </div>
        )}

        {/* State 2: Loading Skeleton */}
        {isLoading && (
          <div className="space-y-4 py-2">
            <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-28 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        )}

        {/* State 3: Error / Fallback Banner */}
        {error && (
          <div className="p-4 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-800 text-sm space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs font-medium">AI Insights Notice</p>
            </div>
            <p className="text-xs text-amber-700">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchBriefing(true)}
              className="text-xs border-amber-300 hover:bg-amber-100 h-7 mt-1"
            >
              Retry
            </Button>
          </div>
        )}

        {/* State 4: Loaded Briefing Content */}
        {briefing && !isLoading && (
          <div className="space-y-5">
            {/* Executive Summary Banner */}
            <div className="p-3.5 rounded-lg bg-indigo-50/50 border border-indigo-100 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900">
                <CheckCircle className="w-4 h-4 text-indigo-600" />
                <span>Executive Situation Summary</span>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">
                {briefing.summary}
              </p>
            </div>

            {/* Key Priorities Grid */}
            {briefing.priorities?.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Highest Operational Priorities ({briefing.priorities.length})
                  </h4>
                  <span className="text-[11px] text-slate-400">Ranked by CRM urgency</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {briefing.priorities.map((item) => (
                    <div
                      key={item.rank}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-indigo-200 transition-all flex flex-col justify-between space-y-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                            {item.rank}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-normal">
                          {item.explanation}
                        </p>
                      </div>

                      {item.evidence?.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                          {item.evidence.map((ev, evIdx) => (
                            <span
                              key={evIdx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* High-Priority Risks */}
            {briefing.risks?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  Identified Operational Risks ({briefing.risks.length})
                </h4>
                <div className="space-y-2">
                  {briefing.risks.map((risk) => (
                    <div
                      key={risk.id}
                      className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(risk.severity)}
                          <span className="text-xs font-semibold text-slate-900">
                            {risk.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{risk.explanation}</p>
                      </div>

                      {risk.recommendedAction && (
                        <div className="sm:text-right shrink-0">
                          <span className="text-[11px] font-medium text-indigo-600 flex items-center gap-1">
                            <ArrowRight className="w-3 h-3" />
                            {risk.recommendedAction}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grounding & Integrity Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  {briefing.limitations?.[0] ||
                    "Grounded strictly in verified CRM records. Deterministic calculations authoritative."}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Generated: {new Date(briefing.generatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
