import { DealStatus, DEAL_STATUS_LABELS } from "@/lib/types/deals";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

interface DealStatusBadgeProps {
  status: DealStatus;
  className?: string;
}

export function DealStatusBadge({ status, className }: DealStatusBadgeProps) {
  switch (status) {
    case "won":
      return (
        <Badge
          variant="outline"
          className={`bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold gap-1 text-[11px] px-2 py-0.5 ${className || ""}`}
        >
          <CheckCircle2 className="h-3 w-3" />
          {DEAL_STATUS_LABELS.won}
        </Badge>
      );
    case "lost":
      return (
        <Badge
          variant="outline"
          className={`bg-rose-50 text-rose-700 border-rose-300 font-semibold gap-1 text-[11px] px-2 py-0.5 ${className || ""}`}
        >
          <XCircle className="h-3 w-3" />
          {DEAL_STATUS_LABELS.lost}
        </Badge>
      );
    case "open":
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-blue-50 text-blue-700 border-blue-300 font-semibold gap-1 text-[11px] px-2 py-0.5 ${className || ""}`}
        >
          <Clock className="h-3 w-3" />
          {DEAL_STATUS_LABELS.open}
        </Badge>
      );
  }
}
