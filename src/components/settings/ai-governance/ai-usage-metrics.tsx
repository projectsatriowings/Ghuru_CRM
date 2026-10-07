"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AIGovernanceUsageMetrics } from "@/lib/types/ai-governance";
import { Activity, CheckCircle, XCircle, Zap, Clock, Calendar } from "lucide-react";

interface AIUsageMetricsProps {
  usage: AIGovernanceUsageMetrics;
}

export function AIUsageMetrics({ usage }: AIUsageMetricsProps) {
  const dailyPct = Math.min(100, usage.dailyUsage.percentage);
  const monthlyPct = Math.min(100, usage.monthlyUsage.percentage);

  return (
    <div className="space-y-4">
      {/* Top 4 Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Requests</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {usage.totalRequests.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Across all endpoints</p>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Successful Requests</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {usage.successfulRequests.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Completed advisory queries</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Failed Requests</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {usage.failedRequests.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Operational errors</p>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Tokens</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {usage.totalTokensConsumed.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Prompt + completion volume</p>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quota Progress Cards (Daily & Monthly) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Allowance */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Daily Request Quota
                </CardTitle>
              </div>
              <span className="text-xs font-bold text-slate-700">
                {dailyPct}% used
              </span>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Resets every 24 hours at midnight UTC
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  dailyPct > 90
                    ? "bg-rose-500"
                    : dailyPct > 70
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Used today: <strong className="text-slate-900">{usage.dailyUsage.used.toLocaleString()}</strong> / {usage.dailyUsage.limit.toLocaleString()}
              </span>
              <span>
                Remaining: <strong className="text-emerald-700">{usage.dailyUsage.remaining.toLocaleString()}</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Allowance */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-500" />
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Monthly Request Quota
                </CardTitle>
              </div>
              <span className="text-xs font-bold text-slate-700">
                {monthlyPct}% used
              </span>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Resets on the 1st of each calendar month
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  monthlyPct > 90
                    ? "bg-rose-500"
                    : monthlyPct > 70
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${monthlyPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Used this month: <strong className="text-slate-900">{usage.monthlyUsage.used.toLocaleString()}</strong> / {usage.monthlyUsage.limit.toLocaleString()}
              </span>
              <span>
                Remaining: <strong className="text-emerald-700">{usage.monthlyUsage.remaining.toLocaleString()}</strong>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
