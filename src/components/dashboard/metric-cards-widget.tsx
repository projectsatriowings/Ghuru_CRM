import React from "react";
import {
  Users,
  AlertTriangle,
  Activity,
  ArrowUpRight,
  Clock,
  Target,
} from "lucide-react";
import { type LeadMetrics, type FollowUpMetrics, type ActivityMetrics, type ConversionMetrics } from "@/lib/types/dashboard";

interface MetricCardsWidgetProps {
  leads: LeadMetrics;
  followUps: FollowUpMetrics;
  activities: ActivityMetrics;
  conversion: ConversionMetrics;
}

export function MetricCardsWidget({
  leads,
  followUps,
  activities,
  conversion,
}: MetricCardsWidgetProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Leads */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Leads
          </span>
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{leads.total}</span>
          <span className="text-xs text-slate-500 font-medium">in range</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
          <span>
            <strong className="text-slate-800">{leads.new}</strong> new
          </span>
          <span>
            <strong className="text-slate-800">{leads.qualified}</strong> qualified
          </span>
          <span>
            <strong className="text-slate-800">{leads.totalAllTime}</strong> all-time
          </span>
        </div>
      </div>

      {/* 2. Conversions */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Conversions
          </span>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Target className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{conversion.convertedLeads}</span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
            <ArrowUpRight className="h-3 w-3" />
            {conversion.conversionRate}%
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
          <span>
            <strong className="text-slate-800">{conversion.totalEligibleLeads}</strong> eligible leads
          </span>
          <span>
            <strong className="text-emerald-700 font-semibold">{conversion.conversionRate}%</strong> rate
          </span>
        </div>
      </div>

      {/* 3. Follow-ups */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Follow-Ups
          </span>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            followUps.overdue > 0 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
          }`}>
            {followUps.overdue > 0 ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{followUps.pending}</span>
          <span className="text-xs text-slate-500 font-medium">pending</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs pt-2.5 border-t border-slate-100">
          <span className={followUps.overdue > 0 ? "text-red-600 font-bold" : "text-slate-500"}>
            <strong>{followUps.overdue}</strong> overdue
          </span>
          <span className="text-amber-700 font-medium">
            <strong>{followUps.dueToday}</strong> due today
          </span>
          <span className="text-slate-500">
            <strong>{followUps.completed}</strong> done
          </span>
        </div>
      </div>

      {/* 4. Activities Today */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Activities Today
          </span>
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900">{activities.today}</span>
          <span className="text-xs text-slate-500 font-medium">logged today</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
          <span>
            <strong className="text-slate-800">{activities.thisWeek}</strong> this week
          </span>
          <span>
            <strong className="text-slate-800">{activities.completed}</strong> completed
          </span>
        </div>
      </div>
    </div>
  );
}
