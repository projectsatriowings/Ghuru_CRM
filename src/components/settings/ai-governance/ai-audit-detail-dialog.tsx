"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AIAuditLogItem } from "@/lib/types/ai-governance";
import { ShieldAlert, CheckCircle2, XCircle, Clock, Zap } from "lucide-react";

interface AIAuditDetailDialogProps {
  event: AIAuditLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIAuditDetailDialog({
  event,
  open,
  onOpenChange,
}: AIAuditDetailDialogProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader className="pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between pr-4">
            <DialogTitle className="text-base font-semibold text-slate-900">
              AI Audit Event Details
            </DialogTitle>
            {event.status === "success" ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Success
              </Badge>
            ) : (
              <Badge className="bg-rose-50 text-rose-700 border-rose-200 gap-1 text-xs">
                <XCircle className="h-3 w-3 text-rose-600" />
                Failure
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-slate-500 font-mono">
            Correlation ID: {event.correlationId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-lg border border-slate-100">
            <div>
              <span className="text-slate-500 block mb-0.5">Timestamp</span>
              <span className="font-medium text-slate-900">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">User / Member</span>
              <span className="font-medium text-slate-900">{event.userName}</span>
              <span className="text-[11px] text-slate-500 block">{event.userEmail}</span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Endpoint</span>
              <span className="font-mono font-medium text-slate-900">
                /{event.endpoint}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Duration</span>
              <span className="font-medium text-slate-900 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {event.durationMs} ms
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Provider</span>
              <span className="font-medium text-slate-900 capitalize">
                {event.provider}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">Model</span>
              <span className="font-mono text-slate-900 text-[11px]">
                {event.model}
              </span>
            </div>
          </div>

          {/* Tokens Consumption Breakdown */}
          <div className="bg-purple-50/50 p-3.5 rounded-lg border border-purple-100/80">
            <div className="flex items-center gap-1.5 font-semibold text-purple-900 mb-2">
              <Zap className="h-3.5 w-3.5 text-purple-600" />
              <span>Token Consumption</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded border border-purple-100">
                <span className="text-[10px] text-slate-500 block">Prompt</span>
                <span className="font-mono font-bold text-slate-900">
                  {event.promptTokens?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div className="bg-white p-2 rounded border border-purple-100">
                <span className="text-[10px] text-slate-500 block">Completion</span>
                <span className="font-mono font-bold text-slate-900">
                  {event.completionTokens?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div className="bg-white p-2 rounded border border-purple-100">
                <span className="text-[10px] text-slate-500 block">Total</span>
                <span className="font-mono font-bold text-purple-700">
                  {event.totalTokens?.toLocaleString() ?? "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Error Details (if applicable) */}
          {event.errorCategory && (
            <div className="bg-rose-50/70 p-3 rounded-lg border border-rose-200 text-rose-900">
              <span className="font-semibold block mb-0.5">Error Category</span>
              <span className="font-mono font-bold text-rose-700">
                {event.errorCategory}
              </span>
            </div>
          )}

          {/* Compliance & Privacy Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-blue-50 border border-blue-100 text-blue-900">
            <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Privacy Assurance:</strong> This record contains operational metadata only. CRM prompts, customer context, and provider credentials are never retained in durable audit storage.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
