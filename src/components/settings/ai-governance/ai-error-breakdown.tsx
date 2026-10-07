"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIErrorSummaryItem } from "@/lib/types/ai-governance";
import { AlertOctagon, CheckCircle2 } from "lucide-react";

interface AIErrorBreakdownProps {
  errors: AIErrorSummaryItem[];
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  PROVIDER_NOT_CONFIGURED: "AI provider or API key is not configured on the server.",
  PROVIDER_TIMEOUT: "Upstream provider request timed out before returning a response.",
  PROVIDER_UNAVAILABLE: "Upstream AI provider endpoint was unreachable or returned a 5xx error.",
  PROVIDER_AUTH_ERROR: "Upstream AI provider rejected the server authorization credentials.",
  PROVIDER_RATE_LIMITED: "Upstream AI provider temporarily throttled requests due to external rate limits.",
  INVALID_PROVIDER_RESPONSE: "Provider returned unparseable or malformed completion data.",
  AI_REQUEST_LIMIT_EXCEEDED: "Organization daily or monthly request allowance threshold reached.",
  AI_PERMISSION_DENIED: "User lacks required RBAC permissions to access AI features.",
  AI_CONTEXT_UNAVAILABLE: "CRM database context could not be assembled for intelligence query.",
};

export function AIErrorBreakdown({ errors }: AIErrorBreakdownProps) {
  if (errors.length === 0) {
    return (
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-6 text-center">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-full mb-2">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900">Zero Recorded Operational Failures</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All AI requests for this organization have executed cleanly without provider, quota, or network errors.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Operational Error Distribution
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Deterministic categorization of provider and quota issues
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg overflow-hidden">
          {errors.map((item) => (
            <div
              key={item.errorCategory}
              className="p-3.5 bg-white hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[11px] font-semibold text-rose-700 bg-rose-50 border-rose-200">
                    {item.errorCategory}
                  </Badge>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500">
                    Last occurred: {new Date(item.lastOccurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px]">
                  {ERROR_DESCRIPTIONS[item.errorCategory] || "Uncategorized AI operational failure."}
                </p>
                {item.affectedEndpoints.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                      Endpoints:
                    </span>
                    {item.affectedEndpoints.map((ep) => (
                      <span
                        key={ep}
                        className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono"
                      >
                        {ep}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="sm:text-right shrink-0">
                <span className="text-lg font-bold text-rose-600">
                  {item.count.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 block">incidents</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
