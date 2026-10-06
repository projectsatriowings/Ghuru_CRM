"use client";

import React from "react";
import Link from "next/link";
import { UserX, AlertCircle, CheckCircle2, ArrowUpRight } from "lucide-react";
import { type UnassignedWorkload } from "@/lib/types/team-owner-intelligence";

interface UnassignedWorkWidgetProps {
  unassigned?: UnassignedWorkload;
}

export function UnassignedWorkWidget({ unassigned }: UnassignedWorkWidgetProps) {
  if (!unassigned) return null;

  const totalUnassigned =
    unassigned.unassignedLeads +
    unassigned.unassignedOpenDeals +
    unassigned.unassignedFollowUps;

  const currencyEntries = Object.entries(
    unassigned.unassignedOpenDealValueByCurrency || {}
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              totalUnassigned > 0
                ? "bg-amber-50 text-amber-600"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {totalUnassigned > 0 ? (
              <UserX className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Unassigned Workload</h3>
            <p className="text-xs text-slate-500">
              Operational ownership gaps across leads, deals, and follow-ups
            </p>
          </div>
        </div>

        {totalUnassigned > 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 self-start sm:self-auto">
            <AlertCircle className="h-3.5 w-3.5" />
            {totalUnassigned} Unassigned {totalUnassigned === 1 ? "Item" : "Items"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 self-start sm:self-auto">
            <CheckCircle2 className="h-3.5 w-3.5" />
            All Work Assigned
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Unassigned Leads */}
        <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unassigned Leads
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  unassigned.unassignedLeads > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200/60 text-slate-600"
                }`}
              >
                {unassigned.unassignedLeads}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {unassigned.unassignedLeads}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leads awaiting owner assignment to start outreach
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Leads <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Unassigned Open Deals */}
        <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unassigned Open Deals
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  unassigned.unassignedOpenDeals > 0
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-200/60 text-slate-600"
                }`}
              >
                {unassigned.unassignedOpenDeals}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {unassigned.unassignedOpenDeals}
            </div>
            {currencyEntries.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {currencyEntries.map(([curr, amt]) => (
                  <span
                    key={curr}
                    className="text-xs font-semibold px-2 py-0.5 bg-slate-200/80 text-slate-800 rounded"
                  >
                    {curr} {amt.toLocaleString()}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                Open pipeline value without deal owner
              </p>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
            <Link
              href="/deals"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              View Deals <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Unassigned Follow-ups */}
        <div className="p-4 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Unassigned Follow-ups
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  unassigned.unassignedFollowUps > 0
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200/60 text-slate-600"
                }`}
              >
                {unassigned.unassignedFollowUps}
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {unassigned.unassignedFollowUps}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Next actions scheduled without assigned owner
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200/60 flex justify-end">
            <Link
              href="/leads"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              Review Actions <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
