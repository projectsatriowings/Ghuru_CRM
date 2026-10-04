import React from "react";
import {
  Activity,
  Phone,
  Mail,
  Users,
  FileText,
  CheckSquare,
  Clock,
  ArrowRightLeft,
  UserCheck,
  Award,
  Link2,
} from "lucide-react";
import { type ActivityMetrics } from "@/lib/types/dashboard";
import { type ActivityType } from "@/db/schema";

interface ActivityWidgetProps {
  activities: ActivityMetrics;
}

const TYPE_ICONS: Record<ActivityType, React.ElementType> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  note: FileText,
  task: CheckSquare,
  follow_up: Clock,
  status_change: ArrowRightLeft,
  assignment_change: UserCheck,
  conversion: Award,
  relationship_change: Link2,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  task: "Task",
  follow_up: "Follow-Up",
  status_change: "Status Change",
  assignment_change: "Assignment Change",
  conversion: "Conversion",
  relationship_change: "Relationship",
};

export function ActivityWidget({ activities }: ActivityWidgetProps) {
  const types = Object.entries(activities.byType) as [ActivityType, number][];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Activity Breakdown</h3>
              <p className="text-xs text-slate-500">Touchpoints across leads, contacts & companies</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {activities.today} Today
          </span>
        </div>

        {/* 3 Metric Pills */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Today</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{activities.today}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">This Week</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{activities.thisWeek}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Completed</span>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{activities.completed}</p>
          </div>
        </div>

        {/* All 10 Activity Types Breakdown */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Activity Types Distribution
          </div>
          <div className="grid grid-cols-2 gap-2">
            {types.map(([typeKey, count]) => {
              const Icon = TYPE_ICONS[typeKey] || Activity;
              return (
                <div
                  key={typeKey}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate pr-1">
                    <Icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="text-slate-700 font-medium truncate">
                      {TYPE_LABELS[typeKey] || typeKey}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
