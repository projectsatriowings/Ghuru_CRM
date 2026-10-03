"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type LeadWithRelations } from "@/lib/types/leads";
import { type PipelineWithStages } from "@/lib/types/pipelines";
import { updateLeadAction } from "@/lib/actions/lead.actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitBranch, Edit2, Loader2, Check, AlertCircle } from "lucide-react";

interface LeadPipelineCardProps {
  lead: LeadWithRelations;
  pipelines: PipelineWithStages[];
  canUpdate: boolean;
}

export function LeadPipelineCard({
  lead,
  pipelines,
  canUpdate,
}: LeadPipelineCardProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Find the assigned pipeline from active pipelines to get its stages
  const currentPipeline = lead.pipelineId
    ? pipelines.find((p) => p.id === lead.pipelineId)
    : null;

  // Stages sorted by displayOrder
  const stages = currentPipeline?.stages
    ? [...currentPipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  const handleStageChange = async (newStageId: string | null) => {
    if (!newStageId || newStageId === lead.stageId || updating) return;

    setUpdating(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await updateLeadAction(lead.id, {
        stageId: newStageId,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to update stage.");
      } else {
        setSuccessMessage("Stage updated");
        setTimeout(() => setSuccessMessage(null), 3000);
        router.refresh();
      }
    } catch {
      setErrorMessage("An unexpected error occurred while updating stage.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Pipeline & Stage
          </h3>
        </div>
        {canUpdate && lead.pipelineId && (
          <Link
            href={`/leads/${lead.id}/edit`}
            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Edit2 className="h-3 w-3" />
            <span>Change</span>
          </Link>
        )}
      </div>

      {/* Pipeline */}
      <div>
        <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
          Pipeline
        </span>
        {lead.pipeline ? (
          <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            {lead.pipeline.name}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 italic">Not assigned</span>
            {canUpdate && (
              <Link href={`/leads/${lead.id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  Assign Pipeline
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Stage */}
      <div>
        <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
          Current Stage
        </span>
        {lead.pipelineId ? (
          canUpdate && stages.length > 0 ? (
            <div className="space-y-1.5">
              <Select
                value={lead.stageId || ""}
                onValueChange={handleStageChange}
                disabled={updating}
              >
                <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem
                      key={stage.id}
                      value={stage.id}
                      className="text-xs"
                    >
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status indicator */}
              {updating && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                  <span>Updating stage...</span>
                </div>
              )}
              {successMessage && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 pt-1 font-medium">
                  <Check className="h-3 w-3" />
                  <span>{successMessage}</span>
                </div>
              )}
              {errorMessage && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-600 pt-1 font-medium">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {lead.stage?.name || "Not assigned"}
            </div>
          )
        ) : (
          <span className="text-xs text-slate-400 italic">Not assigned</span>
        )}
      </div>
    </div>
  );
}
