"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AIGovernanceProviderStatus } from "@/lib/types/ai-governance";
import { CheckCircle2, AlertTriangle, XCircle, ShieldCheck, Cpu } from "lucide-react";

interface AIStatusCardProps {
  status: AIGovernanceProviderStatus;
}

export function AIStatusCard({ status }: AIStatusCardProps) {
  const isAvailable = status.availability === "available";
  const isDisabled = status.availability === "disabled";
  const isNotConfigured = status.availability === "not_configured";

  return (
    <Card className="border-slate-200 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                AI Provider & System Status
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Operational runtime status and telemetry
              </CardDescription>
            </div>
          </div>
          <div>
            {isAvailable && (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Available & Ready
              </Badge>
            )}
            {isDisabled && (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 font-medium">
                <XCircle className="h-3.5 w-3.5 text-amber-600" />
                Disabled by Policy
              </Badge>
            )}
            {isNotConfigured && (
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                Not Configured
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-100 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Configuration</span>
            <span className="font-semibold text-slate-900">
              {status.isConfigured ? "Configured" : "Not Configured"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Provider Type</span>
            <span className="font-semibold text-slate-900 capitalize">
              {status.providerType === "mock" ? "Mock Engine (Isolated)" : "OpenAI-compatible"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Model</span>
            <span className="font-semibold text-slate-900 font-mono text-[11px]">
              {status.model}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Last AI Activity</span>
            <span className="font-semibold text-slate-900">
              {status.lastActiveAt
                ? new Date(status.lastActiveAt).toLocaleString()
                : "No recorded activity"}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-md bg-blue-50/60 border border-blue-100/80 text-xs text-blue-900">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-blue-950">
              Zero Secret Exposure & System Independence Guarantee
            </p>
            <p className="text-blue-700 leading-relaxed text-[11px]">
              API keys and provider credentials remain strictly protected in secure server-side environment configurations. CRM records, pipelines, contacts, deals, activities, and standard deterministic CRM intelligence remain 100% operational regardless of AI availability or quota limits.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
