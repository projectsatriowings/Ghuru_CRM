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
import { type PipelineAndConversionIntelligence } from "@/lib/types/pipeline-intelligence";
import { DollarSign, Award } from "lucide-react";

interface MetricCardsWidgetProps {
  leads: LeadMetrics;
  followUps: FollowUpMetrics;
  activities: ActivityMetrics;
  conversion: ConversionMetrics;
  intelligence?: PipelineAndConversionIntelligence;
}

export function MetricCardsWidget({
  leads,
  followUps,
  activities,
  conversion,
  intelligence,
}: MetricCardsWidgetProps) {
  if (intelligence) {
    const totalOpenDeals = intelligence.pipelines.reduce((acc, p) => acc + p.openDealCount, 0);
    const totalWonDeals = intelligence.pipelines.reduce((acc, p) => acc + p.wonDealCount, 0);
    const totalLostDeals = intelligence.pipelines.reduce((acc, p) => acc + p.lostDealCount, 0);
    const closedDeals = totalWonDeals + totalLostDeals;
    const overallWinRate =
      closedDeals > 0 ? Number(((totalWonDeals / closedDeals) * 100).toFixed(1)) : 0;
    const qualifiedCount = intelligence.funnel.qualifiedCount + intelligence.funnel.convertedCount;

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Total Leads */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Leads
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{leads.total}</span>
            <span className="text-[11px] text-slate-400">in range</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex justify-between">
            <span>New: <strong className="text-slate-700">{leads.new}</strong></span>
            <span>All-time: <strong className="text-slate-700">{leads.totalAllTime}</strong></span>
          </div>
        </div>

        {/* 2. Qualified Leads */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Qualified
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{qualifiedCount}</span>
            <span className="text-[11px] font-semibold text-amber-700">
              {intelligence.funnel.qualificationRate}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Contacted: <strong className="text-slate-700">{leads.contacted}</strong></span>
          </div>
        </div>

        {/* 3. Converted Leads */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Converted
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{conversion.convertedLeads}</span>
            <span className="text-[11px] font-semibold text-emerald-700">
              {conversion.conversionRate}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Eligible: <strong className="text-slate-700">{conversion.totalEligibleLeads}</strong></span>
          </div>
        </div>

        {/* 4. Open Deals */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Open Deals
            </span>
            <div className="h-8 w-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{totalOpenDeals}</span>
            <span className="text-[11px] text-slate-400">in pipeline</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Pipelines: <strong className="text-slate-700">{intelligence.pipelines.length}</strong></span>
          </div>
        </div>

        {/* 5. Won Deals */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Won Deals
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-emerald-700">{totalWonDeals}</span>
            <span className="text-[11px] text-slate-400">closed won</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Lost: <strong className="text-slate-700">{totalLostDeals}</strong></span>
          </div>
        </div>

        {/* 6. Win Rate */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Win Rate
            </span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{overallWinRate}%</span>
            <span className="text-[11px] text-slate-400">closed deals</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Closed: <strong className="text-slate-700">{closedDeals}</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback 4 cards when intelligence is omitted
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
