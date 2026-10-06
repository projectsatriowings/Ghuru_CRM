"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AIRecommendedAction } from "@/lib/types/ai";
import {
  ListChecks,
  RefreshCw,
  Shield,
  Tag,
  CheckCircle2,
} from "lucide-react";

interface AINextActionsWidgetProps {
  initialActions?: AIRecommendedAction[];
  preset?: string;
  from?: string;
  to?: string;
  assigneeId?: string;
  pipelineId?: string;
}

export function AINextActionsWidget({
  initialActions,
  preset,
  from,
  to,
  assigneeId,
  pipelineId,
}: AINextActionsWidgetProps) {
  const [customActions, setCustomActions] = useState<AIRecommendedAction[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions = customActions !== null ? customActions : (initialActions || []);

  const fetchActions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      if (preset) query.set("preset", preset);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (assigneeId) query.set("assigneeId", assigneeId);
      if (pipelineId) query.set("pipelineId", pipelineId);

      const res = await fetch(`/api/v1/intelligence/ai/next-actions?${query.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to load next actions.");
      }

      setCustomActions(json.data.actions || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI recommendations unavailable."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-rose-500 text-white text-[10px]">High Priority</Badge>;
      case "medium":
        return <Badge className="bg-amber-500 text-white text-[10px]">Medium</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px]">Low</Badge>;
    }
  };

  const getEntityBadge = (entityType?: string) => {
    if (!entityType) return null;
    return (
      <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider border-slate-200">
        <Tag className="w-2.5 h-2.5 mr-1" />
        {entityType}
      </Badge>
    );
  };

  return (
    <Card className="shadow-xs border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <ListChecks className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">
                AI Recommended Next Actions
              </CardTitle>
              <p className="text-[11px] text-slate-500">
                Actionable operational recommendations (Advisory only · Non-destructive)
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchActions}
            disabled={isLoading}
            className="h-7 text-xs text-slate-500 hover:text-slate-800"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {isLoading && (
          <div className="space-y-2 py-2">
            <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            {error}
          </div>
        )}

        {!isLoading && actions.length === 0 && !error && (
          <div className="py-6 text-center text-xs text-slate-500 space-y-2">
            <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500" />
            <p>No immediate operational actions required.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchActions}
              className="text-xs h-7"
            >
              Check for Recommended Actions
            </Button>
          </div>
        )}

        {!isLoading && actions.length > 0 && (
          <div className="space-y-2.5">
            {actions.map((act) => (
              <div
                key={act.id}
                className="p-3 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">
                      {act.title}
                    </span>
                    {getPriorityBadge(act.priority)}
                    {getEntityBadge(act.entityType)}
                  </div>
                  <p className="text-xs text-slate-600 leading-normal">
                    {act.reason}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                    {act.confidence} confidence
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-slate-400" />
            Advisory layer: AI does not execute automatic actions.
          </span>
          <span>{actions.length} items</span>
        </div>
      </CardContent>
    </Card>
  );
}
