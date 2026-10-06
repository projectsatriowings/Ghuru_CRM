"use client";

import React from "react";
import { Users2, Info } from "lucide-react";
import { type TeamIntelligenceItem } from "@/lib/types/team-owner-intelligence";

interface TeamIntelligenceWidgetProps {
  teams?: TeamIntelligenceItem[];
}

export function TeamIntelligenceWidget({
  teams = [],
}: TeamIntelligenceWidgetProps) {
  if (!teams || teams.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Users2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Team Intelligence</h3>
            <p className="text-xs text-slate-500">
              Departmental workload aggregation and closed-deal outcomes
            </p>
          </div>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          No teams configured in this organization yet. Group members into teams to view departmental intelligence.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
            <Users2 className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Team Intelligence & Performance</h3>
            <p className="text-xs text-slate-500">
              Aggregated team workload, closed deal win rates, and operational volume
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
          {teams.length} Active {teams.length === 1 ? "Team" : "Teams"}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] bg-slate-50/60">
              <th className="py-2.5 px-3">Team</th>
              <th className="py-2.5 px-3">Members</th>
              <th className="py-2.5 px-3">Assigned Leads</th>
              <th className="py-2.5 px-3">Open Deals</th>
              <th className="py-2.5 px-3">Won / Lost</th>
              <th className="py-2.5 px-3">Win Rate</th>
              <th className="py-2.5 px-3">Overdue Actions</th>
              <th className="py-2.5 px-3">Activities</th>
              <th className="py-2.5 px-3">Open Pipeline Value</th>
              <th className="py-2.5 px-3">Won Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {teams.map((team) => {
              const openCurrencies = Object.entries(team.openValueByCurrency || {});
              const wonCurrencies = Object.entries(team.wonValueByCurrency || {});

              return (
                <tr key={team.teamId} className="hover:bg-slate-50/70 transition-colors">
                  {/* Team Name */}
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    <div>{team.name}</div>
                    {team.description && (
                      <div className="text-[11px] text-slate-400 font-normal truncate max-w-[180px]">
                        {team.description}
                      </div>
                    )}
                  </td>

                  {/* Members */}
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {team.memberCount}{" "}
                    <span className="text-slate-400 text-[11px]">
                      {team.memberCount === 1 ? "member" : "members"}
                    </span>
                  </td>

                  {/* Assigned Leads */}
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-900">
                      {team.totalLeads}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">
                      ({team.qualifiedLeads} qual · {team.convertedLeads} conv)
                    </span>
                  </td>

                  {/* Open Deals */}
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {team.openDeals}
                  </td>

                  {/* Won / Lost */}
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 font-semibold">
                      {team.wonDeals}W
                    </span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-700 font-semibold">
                      {team.lostDeals}L
                    </span>
                  </td>

                  {/* Win Rate */}
                  <td className="py-2.5 px-3">
                    {team.closedDeals > 0 ? (
                      <div>
                        <span className="font-semibold text-slate-900">
                          {team.winRate}%
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">
                          ({team.wonDeals}/{team.closedDeals})
                        </span>
                        {!team.hasSufficientClosedDeals && (
                          <span
                            title="Sample size under 3 closed deals"
                            className="ml-1 text-[10px] text-amber-600 font-medium"
                          >
                            *
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">No closed deals</span>
                    )}
                  </td>

                  {/* Overdue Follow-ups */}
                  <td className="py-2.5 px-3">
                    {team.overdueFollowUps > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        {team.overdueFollowUps} overdue
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium text-[11px]">
                        0 overdue
                      </span>
                    )}
                  </td>

                  {/* Operational Activities */}
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {team.activityVolume}
                  </td>

                  {/* Open Value */}
                  <td className="py-2.5 px-3">
                    {openCurrencies.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {openCurrencies.map(([curr, amt]) => (
                          <span
                            key={curr}
                            className="font-semibold text-slate-800 text-[11px]"
                          >
                            {curr} {amt.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Won Value */}
                  <td className="py-2.5 px-3">
                    {wonCurrencies.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {wonCurrencies.map(([curr, amt]) => (
                          <span
                            key={curr}
                            className="font-semibold text-emerald-700 text-[11px]"
                          >
                            {curr} {amt.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Note about small samples */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1">
        <Info className="h-3 w-3 text-slate-400 shrink-0" />
        <span>
          * Win rate represents closed deals only: Won / (Won + Lost). Multi-currency financial amounts remain strictly grouped by currency.
        </span>
      </div>
    </div>
  );
}
