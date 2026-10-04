"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Clock,
  ArrowRight,
  User,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { type MyWorkMetrics } from "@/lib/types/dashboard";
import { LEAD_STATUS_LABELS } from "@/lib/types/leads";

interface MyWorkWidgetProps {
  myWork: MyWorkMetrics;
}

export function MyWorkWidget({ myWork }: MyWorkWidgetProps) {
  const [activeTab, setActiveTab] = useState<"urgent" | "today" | "leads" | "activities">("urgent");

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Briefcase className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">My Operational Work</h3>
            <p className="text-xs text-slate-500">Your assigned tasks, follow-ups, and leads</p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("urgent")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "urgent"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Overdue ({myWork.overdueFollowUpsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "today"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Due Today ({myWork.followUpsDueToday.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("leads")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "leads"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            My Leads ({myWork.assignedLeadsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activities")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              activeTab === "activities"
                ? "bg-white text-slate-900 shadow-xs font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Recent
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[360px]">
        {/* Tab: Overdue */}
        {activeTab === "urgent" && (
          <div>
            {myWork.overdueFollowUps.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-medium text-slate-700">No overdue follow-ups!</p>
                <p className="text-xs text-slate-400 mt-0.5">You are completely up-to-date.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myWork.overdueFollowUps.map((fu) => (
                  <Link
                    key={fu.id}
                    href={`/leads/${fu.leadId}`}
                    className="group block p-3 rounded-lg border border-red-100 bg-red-50/40 hover:bg-red-50/70 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-red-700">
                            {fu.title}
                          </span>
                          <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium">
                            Due {new Date(fu.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                          Lead: <span className="font-medium text-slate-800">{fu.leadName}</span>
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-red-400 group-hover:text-red-700 transition-colors shrink-0 mt-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Due Today */}
        {activeTab === "today" && (
          <div>
            {myWork.followUpsDueToday.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No follow-ups due today</p>
                <p className="text-xs text-slate-400 mt-0.5">Check upcoming days or review your leads.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myWork.followUpsDueToday.map((fu) => (
                  <Link
                    key={fu.id}
                    href={`/leads/${fu.leadId}`}
                    className="group block p-3 rounded-lg border border-amber-200/70 bg-amber-50/30 hover:bg-amber-50/60 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-amber-800">
                            {fu.title}
                          </span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">
                            Due Today
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                          Lead: <span className="font-medium text-slate-800">{fu.leadName}</span>
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-800 transition-colors shrink-0 mt-0.5" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: My Assigned Leads */}
        {activeTab === "leads" && (
          <div>
            {myWork.recentAssignedLeads.length === 0 ? (
              <div className="py-8 text-center">
                <User className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No leads assigned yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Leads assigned to you will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myWork.recentAssignedLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="group flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 truncate">
                        {lead.name}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                        {lead.email || "No email provided"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {LEAD_STATUS_LABELS[lead.status as keyof typeof LEAD_STATUS_LABELS] || lead.status}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Recent Activities */}
        {activeTab === "activities" && (
          <div>
            {myWork.recentActivities.length === 0 ? (
              <div className="py-8 text-center">
                <Activity className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No recent activities</p>
                <p className="text-xs text-slate-400 mt-0.5">Your recorded activities will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myWork.recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{act.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(act.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="capitalize px-1.5 py-0.5 rounded bg-slate-100 font-medium">
                        {act.type.replace(/_/g, " ")}
                      </span>
                      <span>for {act.entityType}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
