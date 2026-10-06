"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type AIExplanationResult } from "@/lib/types/ai";
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface AIExplanationDialogProps {
  metricKey: string | null;
  metricLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIExplanationDialog({
  metricKey,
  metricLabel,
  open,
  onOpenChange,
}: AIExplanationDialogProps) {
  const [data, setData] = useState<AIExplanationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = () => {
    if (!metricKey) return;
    setIsLoading(true);
    setError(null);

    fetch("/api/v1/intelligence/ai/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metricKey }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          throw new Error(
            json.error?.message || "Failed to generate explanation for this metric."
          );
        }
        setData(json.data);
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "AI insights are temporarily unavailable. Your CRM data remains fully operational."
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    if (!open || !metricKey) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;
      setIsLoading(true);
      setError(null);

      fetch("/api/v1/intelligence/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricKey }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (cancelled) return;
          if (!json.success) {
            throw new Error(
              json.error?.message || "Failed to generate explanation for this metric."
            );
          }
          setData(json.data);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(
            err instanceof Error
              ? err.message
              : "AI insights are temporarily unavailable. Your CRM data remains fully operational."
          );
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, metricKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                AI Metric Explanation: {metricLabel}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Grounded explanation synthesized from deterministic CRM services
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="py-8 space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              Analyzing deterministic CRM metrics & pipeline history...
            </div>
            <div className="space-y-3">
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-24 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-20 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">AI Explanation Notice</p>
                <p className="text-xs text-amber-700 mt-0.5">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchExplanation}
              className="text-xs border-amber-300 hover:bg-amber-100"
            >
              Retry Explanation
            </Button>
          </div>
        )}

        {data && !isLoading && (
          <div className="space-y-5 py-2">
            {/* Fact Box */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold tracking-wide uppercase text-slate-600">
                  CRM Fact (Authoritative)
                </span>
              </div>
              <p className="text-sm font-medium text-slate-900">{data.fact}</p>
            </div>

            {/* Interpretation */}
            <div className="p-3.5 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold tracking-wide uppercase text-indigo-700">
                  AI Operational Interpretation
                </span>
                <Badge variant="outline" className="text-[10px] ml-auto border-indigo-200 text-indigo-700 bg-white">
                  {data.confidence} confidence
                </Badge>
              </div>
              <p className="text-sm text-slate-800 leading-relaxed">
                {data.interpretation}
              </p>
            </div>

            {/* Contributing Factors */}
            {data.contributingFactors?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Contributing Factors from CRM Data
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {data.contributingFactors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-500 font-bold">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                  Recommended Operational Next Steps
                </h4>
                <ul className="space-y-1.5 text-sm text-slate-700">
                  {data.recommendations.map((rec, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded bg-slate-50 border border-slate-100 text-xs flex items-start gap-2"
                    >
                      <span className="font-semibold text-indigo-600">→</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Data Boundary Footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {data.limitations?.[0] ||
                  "Grounded strictly in deterministic CRM metrics. No external assumptions."}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
