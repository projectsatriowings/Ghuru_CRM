import { type FollowUpStatus } from "@/db/schema/follow-ups";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

interface FollowUpStatusBadgeProps {
  status: FollowUpStatus;
  className?: string;
}

export function FollowUpStatusBadge({
  status,
  className = "",
}: FollowUpStatusBadgeProps) {
  switch (status) {
    case "pending":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 ${className}`}
        >
          <Clock className="h-3 w-3" />
          Pending
        </span>
      );
    case "completed":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${className}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 ${className}`}
        >
          <XCircle className="h-3 w-3" />
          Cancelled
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 ${className}`}
        >
          {status}
        </span>
      );
  }
}
