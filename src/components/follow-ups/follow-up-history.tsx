"use client";

import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { FollowUpStatusBadge } from "./follow-up-status-badge";
import { Button } from "@/components/ui/button";
import {
  History,
  CheckCircle2,
  Calendar,
  User,
  Edit2,
  Archive,
} from "lucide-react";
import {
  completeFollowUpAction,
  archiveFollowUpAction,
} from "@/lib/actions/follow-up.actions";

interface FollowUpHistoryProps {
  leadId: string;
  historyList: FollowUpWithRelations[];
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (followUp: FollowUpWithRelations) => void;
  onRefresh?: () => void;
}

export function FollowUpHistory({
  leadId,
  historyList,
  canUpdate,
  canDelete,
  onEdit,
  onRefresh,
}: FollowUpHistoryProps) {
  async function handleComplete(id: string) {
    await completeFollowUpAction(id, leadId);
    if (onRefresh) onRefresh();
  }

  async function handleArchive(id: string) {
    if (confirm("Are you sure you want to archive this follow-up record?")) {
      await archiveFollowUpAction(id, leadId);
      if (onRefresh) onRefresh();
    }
  }

  const formatDue = (dateStr: string, timeStr: string | null) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const targetDate = new Date(year, month - 1, day);
      const formatted = targetDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${formatted}${timeStr ? ` ${timeStr}` : ""}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Follow-up History
          </h2>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {historyList.length}
          </span>
        </div>
      </div>

      <div className="p-5">
        {historyList.length === 0 ? (
          <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/30">
            <p className="text-xs text-slate-400 italic">
              No follow-up history recorded for this lead.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {historyList.map((item) => (
              <div
                key={item.id}
                className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">
                      {item.title}
                    </h4>
                    <FollowUpStatusBadge status={item.status} />
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-0.5">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      <span>{formatDue(item.dueDate, item.dueTime)}</span>
                    </div>

                    {item.assignedToUser && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        <span>{item.assignedToUser.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  {canUpdate && item.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(item.id)}
                      className="h-7 px-2 text-[11px] font-medium text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-md gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Complete</span>
                    </Button>
                  )}

                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                      title="Edit Follow-up"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleArchive(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Archive Follow-up"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
