import React from "react";
import { Clock, AlertTriangle, CalendarCheck, CheckCircle2, UserCheck, Users } from "lucide-react";
import { type FollowUpMetrics } from "@/lib/types/dashboard";

interface FollowUpWidgetProps {
  followUps: FollowUpMetrics;
}

export function FollowUpWidget({ followUps }: FollowUpWidgetProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              followUps.overdue > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
            }`}>
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Follow-Ups & Next Actions</h3>
              <p className="text-xs text-slate-500">Scheduled touchpoints and status</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            {followUps.pending} Pending
          </span>
        </div>

        {/* 4 Urgency Cards */}
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className={`p-3 rounded-lg border flex flex-col justify-between ${
            followUps.overdue > 0
              ? "bg-red-50/40 border-red-200/70 text-red-700"
              : "bg-slate-50/50 border-slate-100 text-slate-600"
          }`}>
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Overdue</span>
              <AlertTriangle className="h-3.5 w-3.5" />
            </div>
            <span className="text-xl font-bold mt-2">{followUps.overdue}</span>
          </div>

          <div className="p-3 rounded-lg border border-amber-200/70 bg-amber-50/40 text-amber-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Due Today</span>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <span className="text-xl font-bold mt-2">{followUps.dueToday}</span>
          </div>

          <div className="p-3 rounded-lg border border-blue-200/70 bg-blue-50/40 text-blue-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Due This Week</span>
              <CalendarCheck className="h-3.5 w-3.5" />
            </div>
            <span className="text-xl font-bold mt-2">{followUps.dueThisWeek}</span>
          </div>

          <div className="p-3 rounded-lg border border-emerald-200/70 bg-emerald-50/40 text-emerald-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Completed</span>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <span className="text-xl font-bold mt-2">{followUps.completed}</span>
          </div>
        </div>

        {/* Assignment Scope */}
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Assignment Distribution
          </div>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
              Assigned to Me
            </span>
            <span className="font-bold text-slate-900">{followUps.myPending}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Assigned to Others
            </span>
            <span className="font-bold text-slate-900">
              {Math.max(0, followUps.pending - followUps.myPending)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
