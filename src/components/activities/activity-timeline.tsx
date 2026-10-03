"use client";

import { useState } from "react";
import { type ActivityWithRelations } from "@/lib/types/activities";
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
} from "lucide-react";

interface ActivityTimelineProps {
  leadId: string;
  activities: ActivityWithRelations[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onRefresh?: () => void;
}

export function ActivityTimeline({
  leadId,
  activities,
  canCreate,
  canUpdate,
  canDelete,
  onRefresh,
}: ActivityTimelineProps) {
  const [editingActivity, setEditingActivity] =
    useState<ActivityWithRelations | null>(null);
  const [archivingActivity, setArchivingActivity] =
    useState<ActivityWithRelations | null>(null);

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
          <AddActivityDialog leadId={leadId} onSuccess={onRefresh} />
        )}
      </div>

      {/* Content Area */}
      <div className="p-5">
        {activities.length === 0 ? (
          /* Empty State (Section 11) */
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 space-y-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">
                No activities yet
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Record calls, meetings, notes and other interactions with this lead.
              </p>
            </div>
            {canCreate && (
              <div className="pt-1">
                <AddActivityDialog
                  leadId={leadId}
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
          /* Timeline List */
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
            {activities.map((act) => {
              const formattedDate = new Date(act.createdAt).toLocaleString(
                undefined,
                {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                }
              );

              return (
                <div key={act.id} className="relative group">
                  {/* Timeline Node Icon */}
                  <div className="absolute -left-[1.875rem] top-0.5 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 group-hover:border-blue-300 group-hover:text-blue-600 transition-colors">
                    <ActivityIcon type={act.type} className="h-3 w-3" />
                  </div>

                  {/* Activity Card */}
                  <div className="bg-slate-50/60 rounded-xl border border-slate-200/70 p-4 space-y-2 group-hover:bg-slate-50 group-hover:border-slate-300/80 transition-all">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActivityTypeBadge type={act.type} />
                        <h4 className="text-xs font-bold text-slate-900">
                          {act.title}
                        </h4>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
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

                    {/* Footer Metadata (Created by & Date/Time) */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-slate-200/50">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-600">
                          {act.createdByUser?.name || "Unknown User"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
        leadId={leadId}
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
