import {
  type LeadStatus,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VARIANTS,
} from "@/lib/types/leads";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusBadge({ status, className }: LeadStatusBadgeProps) {
  const variant =
    LEAD_STATUS_VARIANTS[status] || LEAD_STATUS_VARIANTS.new;
  const label = LEAD_STATUS_LABELS[status] || status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border select-none tracking-tight",
        variant.bg,
        variant.text,
        variant.border,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", variant.dot)} />
      {label}
    </span>
  );
}
