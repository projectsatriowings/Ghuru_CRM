import React from "react";
import { HealthState, IntelligenceSeverity } from "@/lib/types/intelligence";
import { CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";

interface HealthStatusBadgeProps {
  state: HealthState;
  className?: string;
  size?: "sm" | "md";
}

export function HealthStatusBadge({
  state,
  className = "",
  size = "md",
}: HealthStatusBadgeProps) {
  const isSm = size === "sm";

  switch (state) {
    case "healthy":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${
            isSm ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          } ${className}`}
        >
          <CheckCircle2 className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Healthy</span>
        </span>
      );

    case "needs_attention":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 ${
            isSm ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          } ${className}`}
        >
          <AlertTriangle className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>Needs Attention</span>
        </span>
      );

    case "at_risk":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200/80 ${
            isSm ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"
          } ${className}`}
        >
          <AlertCircle className={isSm ? "h-3 w-3" : "h-3.5 w-3.5"} />
          <span>At Risk</span>
        </span>
      );
  }
}

interface SeverityBadgeProps {
  severity: IntelligenceSeverity;
  className?: string;
  size?: "xs" | "sm";
}

export function SeverityBadge({
  severity,
  className = "",
  size = "xs",
}: SeverityBadgeProps) {
  const isXs = size === "xs";

  switch (severity) {
    case "critical":
      return (
        <span
          className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
            isXs ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
          } bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
        >
          Critical
        </span>
      );

    case "high":
      return (
        <span
          className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
            isXs ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
          } bg-red-100 text-red-800 border border-red-200 ${className}`}
        >
          High
        </span>
      );

    case "medium":
      return (
        <span
          className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
            isXs ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
          } bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
        >
          Medium
        </span>
      );

    case "low":
      return (
        <span
          className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${
            isXs ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
          } bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        >
          Low
        </span>
      );
  }
}
