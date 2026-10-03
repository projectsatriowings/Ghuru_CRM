"use client";

import { useState, useTransition } from "react";
import { type ActivityWithRelations } from "@/lib/types/activities";
import { type FollowUpWithRelations } from "@/lib/types/follow-ups";
import { type CrmEntityType } from "@/db/schema/activities";
import { completeActivityAction } from "@/lib/actions/activity.actions";
import { completeFollowUpAction } from "@/lib/actions/follow-up.actions";
import { selectPrimaryNextAction } from "@/lib/utils/follow-up-utils";
import { AddActivityDialog } from "./add-activity-dialog";
import { EditActivityDialog } from "./edit-activity-dialog";
import { ArchiveActivityDialog } from "./archive-activity-dialog";
import { ActivityIcon, ActivityTypeBadge } from "./activity-icon";
import { Button } from "@/components/ui/button";
import {
  History,
  Plus,
  Edit2,
  Archive,
  User,
  Clock,
  MessageSquare,
  CheckCircle2,
  Calendar,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";

interface ActivityTimelineProps {
  entityType?: CrmEntityType;
  entityId?: string;
  leadId?: string;
  activities: ActivityWithRelations[];
  followUps?: FollowUpWithRelations[];
  members?: Array<{ id: string; name: string; email: string }>;
  currentUserId?: string;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  onRefresh?: () => void;
}

function formatDateGroup(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline({
  entityType = "lead",
  entityId,
  leadId,
  activities = [],
  followUps,
  members = [],
  canCreate = true,
  canUpdate = true,
  canDelete = true,
  onRefresh,
}: ActivityTimelineProps) {
  const [editingActivity, setEditingActivity] =
    useState<ActivityWithRelations | null>(null);
  const [archivingActivity, setArchivingActivity] =
    useState<ActivityWithRelations | null>(null);
  const [isPending, startTransition] = useTransition();
  const [completingId, setCompletingId] = useState<string | null>(null);

  const targetEntityId = entityId || leadId || "";
  const targetEntityType = entityType || "lead";

  // Check for Primary Next Action from follow-ups if passed
  const primaryFollowUp = followUps ? selectPrimaryNextAction(followUps) : null;

  async function handleQuickCompleteActivity(actId: string) {
    setCompletingId(actId);
    startTransition(async () => {
      await completeActivityAction(actId);
      setCompletingId(null);
      if (onRefresh) onRefresh();
    });
  }

  async function handleQuickCompleteFollowUp(fuId: string) {
    setCompletingId(fuId);
    startTransition(async () => {
      await completeFollowUpAction(fuId, targetEntityId);
      setCompletingId(null);
      if (onRefresh) onRefresh();
    });
  }

  // Group activities by date
  const groupedActivities: Record<string, ActivityWithRelations[]> = {};
  for (const act of activities) {
    const group = formatDateGroup(act.createdAt);
    if (!groupedActivities[group]) {
      groupedActivities[group] = [];
    }
    groupedActivities[group].push(act);
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Section Header */}
      <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Activity Timeline
          </h2>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {activities.length}
          </span>
        </div>

        {canCreate && (
          <AddActivityDialog
            entityType={targetEntityType}
            entityId={targetEntityId}
            leadId={leadId}
            members={members}
            onSuccess={onRefresh}
          />
        )}
      </div>

      {/* Content Area */}
      <div className="p-5 space-y-6">
        {/* Primary Next Action Banner (if active follow-up exists on lead) */}
        {primaryFollowUp && (
          <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-xs">
                  <Clock className="h-3 w-3" /> Next Action
                </span>
                <span className="text-xs font-bold text-slate-900">
                  {primaryFollowUp.title}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {primaryFollowUp.dueDate}
                  {primaryFollowUp.dueTime ? ` · ${primaryFollowUp.dueTime}` : ""}
                </span>
                {primaryFollowUp.assignedToUser && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3 text-slate-400" />
                    {primaryFollowUp.assignedToUser.name}
                  </span>
                )}
              </div>
            </div>

            {canUpdate && (
              <Button
                size="sm"
                onClick={() => handleQuickCompleteFollowUp(primaryFollowUp.id)}
                disabled={isPending && completingId === primaryFollowUp.id}
                className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs gap-1.5 self-start sm:self-auto shrink-0"
              >
                {isPending && completingId === primaryFollowUp.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Mark Complete
              </Button>
            )}
          </div>
        )}

        {activities.length === 0 ? (
          /* Empty State */
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 space-y-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                No activities yet
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Record calls, meetings, notes, tasks, and other interactions.
              </p>
            </div>
            {canCreate && (
              <div className="pt-1">
                <AddActivityDialog
                  entityType={targetEntityType}
                  entityId={targetEntityId}
                  leadId={leadId}
                  members={members}
                  onSuccess={onRefresh}
                  trigger={
                    <Button className="h-8 px-3.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5">
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Add Activity</span>
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        ) : (
          /* Timeline Groups */
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([dateGroup, items]) => (
              <div key={dateGroup} className="space-y-3">
                {/* Date Group Header */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-white pr-2">
                    {dateGroup}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Timeline Items in Group */}
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {items.map((act) => {
                    const isConversion =
                      act.type === "conversion" ||
                      (act.type === "note" &&
                        act.title.toLowerCase().includes("converted"));

                    const formattedTime = new Date(act.createdAt).toLocaleTimeString(
                      undefined,
                      {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      }
                    );

                    return (
                      <div key={act.id} className="relative group">
                        {/* Timeline Node Icon */}
                        <div
                          className={`absolute -left-[1.875rem] top-1 w-6 h-6 rounded-full bg-white border shadow-xs flex items-center justify-center transition-colors ${
                            isConversion
                              ? "border-purple-300 text-purple-600 bg-purple-50/50"
                              : act.status === "completed"
                              ? "border-slate-200 text-slate-600 group-hover:border-blue-300 group-hover:text-blue-600"
                              : "border-amber-300 text-amber-600 bg-amber-50/30"
                          }`}
                        >
                          {isConversion ? (
                            <ArrowRightLeft className="h-3 w-3" />
                          ) : (
                            <ActivityIcon type={act.type} className="h-3 w-3" />
                          )}
                        </div>

                        {/* Activity Card */}
                        <div
                          className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                            isConversion
                              ? "bg-purple-50/30 border-purple-200/80 hover:bg-purple-50/50"
                              : "bg-slate-50/60 border-slate-200/70 hover:bg-slate-50 hover:border-slate-300/80"
                          }`}
                        >
                          {/* Header Row */}
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {isConversion ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                  <ArrowRightLeft className="h-3 w-3" />
                                  Conversion
                                </span>
                              ) : (
                                <ActivityTypeBadge type={act.type} />
                              )}
                              <h4 className="text-xs font-bold text-slate-900">
                                {act.title}
                              </h4>

                              {/* Status Tag */}
                              {act.status === "pending" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Pending
                                </span>
                              )}
                              {act.status === "cancelled" && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Cancelled
                                </span>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              {canUpdate && act.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickCompleteActivity(act.id)}
                                  disabled={
                                    isPending && completingId === act.id
                                  }
                                  className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                                  title="Mark Completed"
                                >
                                  {isPending && completingId === act.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              {canUpdate && (
                                <button
                                  type="button"
                                  onClick={() => setEditingActivity(act)}
                                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-colors"
                                  title="Edit Activity"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => setArchivingActivity(act)}
                                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Archive Activity"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          {act.description && (
                            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pt-0.5">
                              {act.description}
                            </p>
                          )}

                          {/* Footer Metadata */}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-slate-200/50">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-slate-400" />
                              <span className="font-medium text-slate-600">
                                {act.createdByUser?.name || "System"}
                              </span>
                            </div>

                            {act.assignedToUser && (
                              <div className="flex items-center gap-1 text-slate-500">
                                <span>Assigned to:</span>
                                <span className="font-medium text-slate-700">
                                  {act.assignedToUser.name}
                                </span>
                              </div>
                            )}

                            {act.dueAt && (
                              <div className="flex items-center gap-1 text-amber-700 font-mono">
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Due:{" "}
                                  {new Date(act.dueAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}

                            <div className="flex items-center gap-1 font-mono ml-auto">
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{formattedTime}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditActivityDialog
        open={Boolean(editingActivity)}
        onOpenChange={(op) => {
          if (!op) setEditingActivity(null);
        }}
        activity={editingActivity}
        members={members}
        onSuccess={onRefresh}
      />

      {/* Archive Dialog */}
      <ArchiveActivityDialog
        open={Boolean(archivingActivity)}
        onOpenChange={(op) => {
          if (!op) setArchivingActivity(null);
        }}
        activity={archivingActivity}
        leadId={leadId}
        onSuccess={onRefresh}
      />
    </div>
  );
}
