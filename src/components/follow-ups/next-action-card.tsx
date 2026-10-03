"use client";

import { useState } from "react";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { FollowUpStatusBadge } from "./follow-up-status-badge";
import { AddFollowUpDialog } from "./add-follow-up-dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Edit2,
  User,
  Plus,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  completeFollowUpAction,
  cancelFollowUpAction,
} from "@/lib/actions/follow-up.actions";

interface NextActionCardProps {
  leadId: string;
  primaryAction: FollowUpWithRelations | null;
  canCreate: boolean;
  canUpdate: boolean;
  members: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
  onEdit: (followUp: FollowUpWithRelations) => void;
  onRefresh?: () => void;
}

export function NextActionCard({
  leadId,
  primaryAction,
  canCreate,
  canUpdate,
  members,
  currentUserId,
  onEdit,
  onRefresh,
}: NextActionCardProps) {
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function handleComplete() {
    if (!primaryAction || completing) return;
    setCompleting(true);
    try {
      await completeFollowUpAction(primaryAction.id, leadId);
      if (onRefresh) onRefresh();
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancel() {
    if (!primaryAction || cancelling) return;
    setCancelling(true);
    try {
      await cancelFollowUpAction(primaryAction.id, leadId);
      if (onRefresh) onRefresh();
    } finally {
      setCancelling(false);
    }
  }

  // Format date and time
  const formatSchedule = (dateStr: string, timeStr: string | null) => {
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const targetDate = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      let dateLabel = targetDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      if (targetDate.getTime() === today.getTime()) {
        dateLabel = "Today";
      } else if (targetDate.getTime() === tomorrow.getTime()) {
        dateLabel = "Tomorrow";
      }

      let timeLabel = "";
      if (timeStr) {
        const [h, m] = timeStr.split(":");
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        const hour12 = hour % 12 || 12;
        timeLabel = `, ${hour12}:${m} ${ampm}`;
      }

      return `${dateLabel}${timeLabel}`;
    } catch {
      return dateStr + (timeStr ? ` ${timeStr}` : "");
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Next Action
          </h2>
        </div>

        {canCreate && (
          <AddFollowUpDialog
            leadId={leadId}
            currentUserId={currentUserId}
            members={members}
            onSuccess={onRefresh}
            trigger={
              <Button
                variant="outline"
                className="h-7 px-2.5 text-[11px] font-medium text-blue-600 border-blue-200 hover:bg-blue-50 rounded-md gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Add Follow-up</span>
              </Button>
            }
          />
        )}
      </div>

      <div className="p-5">
        {primaryAction ? (
          <div className="bg-gradient-to-r from-blue-50/50 via-indigo-50/30 to-white rounded-xl border border-blue-100/80 p-4 space-y-3">
            {/* Title & Status */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                  Scheduled Next Action
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {primaryAction.title}
                </h3>
              </div>
              <FollowUpStatusBadge status={primaryAction.status} />
            </div>

            {/* Description */}
            {primaryAction.description && (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                {primaryAction.description}
              </p>
            )}

            {/* Schedule & Assignee Details */}
            <div className="flex flex-wrap items-center gap-5 text-xs pt-2 border-t border-blue-100/60">
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <span>
                  {formatSchedule(primaryAction.dueDate, primaryAction.dueTime)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Assigned to:{" "}
                  <strong className="font-semibold text-slate-800">
                    {primaryAction.assignedToUser?.name || "Unassigned"}
                  </strong>
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            {canUpdate && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100/60">
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={completing || cancelling}
                  className="h-8 px-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5"
                >
                  {completing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>Mark Complete</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(primaryAction)}
                  disabled={completing || cancelling}
                  className="h-8 px-3 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg gap-1.5"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={completing || cancelling}
                  className="h-8 px-3 text-xs font-medium text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-lg gap-1.5"
                >
                  {cancelling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5" />
                  )}
                  <span>Cancel</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Empty State (Section 22) */
          <div className="py-6 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 space-y-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <CalendarClock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                No next action scheduled
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                Schedule a follow-up so the team knows what needs to happen next.
              </p>
            </div>
            {canCreate && (
              <div className="pt-1">
                <AddFollowUpDialog
                  leadId={leadId}
                  currentUserId={currentUserId}
                  members={members}
                  onSuccess={onRefresh}
                  trigger={
                    <Button className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Follow-up</span>
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
