import { ActivityType } from "@/db/schema/activities";
import { Phone, Mail, Calendar, FileText, CheckSquare } from "lucide-react";

interface ActivityIconProps {
  type: ActivityType;
  className?: string;
}

export function ActivityIcon({ type, className = "h-4 w-4" }: ActivityIconProps) {
  switch (type) {
    case "call":
      return <Phone className={className} />;
    case "email":
      return <Mail className={className} />;
    case "meeting":
      return <Calendar className={className} />;
    case "note":
      return <FileText className={className} />;
    case "task":
      return <CheckSquare className={className} />;
    default:
      return <FileText className={className} />;
  }
}

export function ActivityTypeBadge({ type }: { type: ActivityType }) {
  switch (type) {
    case "call":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Phone className="h-3 w-3" />
          Call
        </span>
      );
    case "email":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <Mail className="h-3 w-3" />
          Email
        </span>
      );
    case "meeting":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Calendar className="h-3 w-3" />
          Meeting
        </span>
      );
    case "note":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <FileText className="h-3 w-3" />
          Note
        </span>
      );
    case "task":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <CheckSquare className="h-3 w-3" />
          Task
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
          {type}
        </span>
      );
  }
}
