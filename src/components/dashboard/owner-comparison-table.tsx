"use client";

import React, { useState } from "react";
import { Users, ArrowUpDown, Info } from "lucide-react";
import { type OwnerIntelligenceItem } from "@/lib/types/team-owner-intelligence";

interface OwnerComparisonTableProps {
  owners?: OwnerIntelligenceItem[];
}

type SortField =
  | "name"
  | "leads"
  | "conversionRate"
  | "openDeals"
  | "wonDeals"
  | "winRate"
  | "overdueFollowUps"
  | "activities";

export function OwnerComparisonTable({ owners = [] }: OwnerComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("leads");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  if (!owners || owners.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Owner Workload & Performance</h3>
            <p className="text-xs text-slate-500">
              Deterministic owner metrics across leads, deals, and follow-ups
            </p>
          </div>
        </div>
        <div className="py-8 text-center text-slate-400 text-xs">
          No team members or record owners found in this organization.
        </div>
      </div>
    );
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const filteredOwners = owners.filter((o) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.email.toLowerCase().includes(q) ||
      o.teams.some((t) => t.name.toLowerCase().includes(q))
    );
  });

  const sortedOwners = [...filteredOwners].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "leads":
        cmp = a.leads.totalLeads - b.leads.totalLeads;
        break;
      case "conversionRate":
        cmp = a.leadPerformance.conversionRate - b.leadPerformance.conversionRate;
        break;
      case "openDeals":
        cmp = a.deals.openDeals - b.deals.openDeals;
        break;
      case "wonDeals":
        cmp = a.deals.wonDeals - b.deals.wonDeals;
        break;
      case "winRate":
        cmp = a.deals.winRate - b.deals.winRate;
        break;
      case "overdueFollowUps":
        cmp = a.followUps.overdueFollowUps - b.followUps.overdueFollowUps;
        break;
      case "activities":
        cmp = a.activities.totalActivities - b.activities.totalActivities;
        break;
      default:
        cmp = 0;
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Owner Workload & Performance Comparison</h3>
            <p className="text-xs text-slate-500">
              Deterministic attribution of CRM workload, progression rates, and accountability
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search owners or teams..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-48 sm:w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px] bg-slate-50/60">
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  Owner <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("leads")}
              >
                <div className="flex items-center gap-1">
                  Leads (Total / Qual / Conv) <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("conversionRate")}
              >
                <div className="flex items-center gap-1">
                  Conv. Rate <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("openDeals")}
              >
                <div className="flex items-center gap-1">
                  Open Deals <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("wonDeals")}
              >
                <div className="flex items-center gap-1">
                  Won / Lost <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("winRate")}
              >
                <div className="flex items-center gap-1">
                  Win Rate (Won/Closed) <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("overdueFollowUps")}
              >
                <div className="flex items-center gap-1">
                  Overdue Actions <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th
                className="py-2.5 px-3 cursor-pointer hover:text-slate-800"
                onClick={() => handleSort("activities")}
              >
                <div className="flex items-center gap-1">
                  Activities <ArrowUpDown className="h-3 w-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Open Pipeline Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedOwners.map((owner) => {
              const openCurrencies = Object.entries(
                owner.dealValue.openValueByCurrency || {}
              );

              return (
                <tr key={owner.userId} className="hover:bg-slate-50/70 transition-colors">
                  {/* Owner Name & Teams */}
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    <div className="font-semibold">{owner.name}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                      {owner.email}
                    </div>
                    {owner.teams.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {owner.teams.map((t) => (
                          <span
                            key={t.id}
                            className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Leads */}
                  <td className="py-2.5 px-3">
                    <span className="font-semibold text-slate-900">
                      {owner.leads.totalLeads}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">
                      ({owner.leads.qualifiedLeads} qual · {owner.leads.convertedLeads} conv)
                    </span>
                  </td>

                  {/* Conversion Rate */}
                  <td className="py-2.5 px-3">
                    {owner.leads.totalLeads > 0 ? (
                      <span className="font-medium text-slate-800">
                        {owner.leadPerformance.conversionRate}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Open Deals */}
                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                    {owner.deals.openDeals}
                  </td>

                  {/* Won / Lost */}
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-700 font-semibold">
                      {owner.deals.wonDeals}W
                    </span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-rose-700 font-semibold">
                      {owner.deals.lostDeals}L
                    </span>
                  </td>

                  {/* Win Rate */}
                  <td className="py-2.5 px-3">
                    {owner.deals.closedDeals > 0 ? (
                      <div>
                        <span className="font-semibold text-slate-900">
                          {owner.deals.winRate}%
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">
                          ({owner.deals.wonDeals}/{owner.deals.closedDeals})
                        </span>
                        {!owner.deals.hasSufficientClosedDeals && (
                          <span
                            title="Sample size under 3 closed deals. Win rate may not reflect long-term trends."
                            className="ml-1 inline-flex text-[10px] text-amber-600 font-medium"
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
                    {owner.followUps.overdueFollowUps > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        {owner.followUps.overdueFollowUps} overdue
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium text-[11px]">0 overdue</span>
                    )}
                  </td>

                  {/* Operational Activities */}
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {owner.activities.totalActivities}
                  </td>

                  {/* Open Pipeline Value (Grouped by Currency) */}
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
          * Win rate includes closed deals only: Won / (Won + Lost). A minimum sample of 3 closed deals is standard before comparing win rates.
        </span>
      </div>
    </div>
  );
}
