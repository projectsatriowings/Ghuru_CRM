"use client";

import React from "react";
import { type EntityHealthResult } from "@/lib/types/intelligence";
import { HealthStatusBadge, SeverityBadge } from "./health-status-badge";
import {
  Activity,
  Lightbulb,
  Calendar,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface EntityHealthCardProps {
  health: EntityHealthResult;
  onAddFollowUp?: () => void;
  onLogActivity?: () => void;
  className?: string;
}

export function EntityHealthCard({
  health,
  onAddFollowUp,
  onLogActivity,
  className = "",
}: EntityHealthCardProps) {
  const label = health.entityType === "deal" ? "Deal Health" : "Lead Health";

  return (
    <div
      className={`bg-white rounded-xl border shadow-xs overflow-hidden ${
        health.healthState === "at_risk"
          ? "border-red-200"
          : health.healthState === "needs_attention"
          ? "border-amber-200"
          : "border-slate-200/80"
      } ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity
            className={`h-4 w-4 ${
              health.healthState === "at_risk"
                ? "text-red-600"
                : health.healthState === "needs_attention"
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {label}
          </h3>
        </div>
        <HealthStatusBadge state={health.healthState} size="sm" />
      </div>

      <div className="p-5 space-y-4">
        {/* Summary */}
        <p className="text-xs text-slate-600 leading-relaxed">
          {health.summary}
        </p>

        {/* Signals List */}
        {health.signals.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Detected Operational Signals
            </span>
            <div className="space-y-2">
              {health.signals.map((sig) => (
                <div
                  key={sig.id}
                  className={`p-2.5 rounded-lg border text-xs ${
                    sig.severity === "critical"
                      ? "bg-rose-50/40 border-rose-200 text-rose-900"
                      : sig.severity === "high"
                      ? "bg-red-50/40 border-red-200 text-red-900"
                      : "bg-amber-50/40 border-amber-200 text-amber-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[11px] leading-tight">
                      {sig.title}
                    </span>
                    <SeverityBadge severity={sig.severity} size="xs" />
                  </div>
                  <p className="text-[11px] mt-1 text-slate-600 leading-normal">
                    {sig.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Action */}
        {health.recommendedAction && (
          <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200/80 flex items-start gap-2.5">
            <Lightbulb className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                Recommended Action
              </span>
              <p className="text-xs text-blue-800 mt-0.5 leading-normal">
                {health.recommendedAction}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          {onAddFollowUp && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddFollowUp}
              className="w-full text-xs h-8 text-slate-700 hover:text-slate-900"
            >
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Schedule Follow-up
            </Button>
          )}
          {onLogActivity && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLogActivity}
              className="w-full text-xs h-8 text-slate-700 hover:text-slate-900"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
              Log Activity
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
