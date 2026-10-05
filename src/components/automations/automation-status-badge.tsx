"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AutomationStatusBadgeProps {
  active: boolean;
  archivedAt?: Date | string | null;
  className?: string;
}

export function AutomationStatusBadge({
  active,
  archivedAt,
  className,
}: AutomationStatusBadgeProps) {
  if (archivedAt) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-slate-100 text-slate-600 border-slate-300 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Archived
      </Badge>
    );
  }

  if (active) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Active
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "bg-amber-50 text-amber-700 border-amber-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      Inactive
    </Badge>
  );
}

export function ExecutionStatusBadge({
  status,
  className,
}: {
  status: "running" | "completed" | "failed" | "skipped";
  className?: string;
}) {
  switch (status) {
    case "completed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
            className
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-rose-50 text-rose-700 border-rose-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
            className
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Failed
        </Badge>
      );
    case "skipped":
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-slate-100 text-slate-600 border-slate-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
            className
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Skipped
        </Badge>
      );
    case "running":
    default:
      return (
        <Badge
          variant="outline"
          className={cn(
            "bg-blue-50 text-blue-700 border-blue-200 font-medium px-2 py-0.5 text-xs flex items-center gap-1.5",
            className
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin" />
          Running
        </Badge>
      );
  }
}
