"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUp,
  ArrowDown,
  Edit2,
  Archive,
  Layers,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CreateStageDialog } from "./create-stage-dialog";
import { EditStageDialog } from "./edit-stage-dialog";
import {
  moveStageAction,
  archiveStageAction,
} from "@/lib/actions/pipeline.actions";
import { type PipelineStage } from "@/lib/types/pipelines";

interface PipelineStagesListProps {
  pipelineId: string;
  stages: PipelineStage[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function PipelineStagesList({
  pipelineId,
  stages,
  canCreate,
  canUpdate,
  canDelete,
}: PipelineStagesListProps) {
  const router = useRouter();
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [archivingStage, setArchivingStage] = useState<PipelineStage | null>(null);
  const [loadingStageId, setLoadingStageId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleMove = async (stageId: string, direction: "up" | "down") => {
    setLoadingStageId(stageId);
    setActionError(null);
    try {
      const res = await moveStageAction(pipelineId, stageId, direction);
      if (!res.success) {
        setActionError(res.error || "Failed to reorder stage.");
        return;
      }
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reorder stage."
      );
    } finally {
      setLoadingStageId(null);
    }
  };

  const handleArchive = async () => {
    if (!archivingStage) return;
    setArchiveLoading(true);
    setActionError(null);

    try {
      const res = await archiveStageAction(pipelineId, archivingStage.id);
      if (!res.success) {
        setActionError(res.error || "Failed to archive stage.");
        return;
      }
      setArchivingStage(null);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive stage."
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Pipeline Stages
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Stages represent sequential checkpoints in this pipeline journey.
          </p>
        </div>
        {canCreate && <CreateStageDialog pipelineId={pipelineId} />}
      </div>

      {stages.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
            <Layers className="h-5 w-5" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900">
            No stages defined yet
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Add stages to define the path that leads follow in this pipeline.
          </p>
          {canCreate && <CreateStageDialog pipelineId={pipelineId} />}
        </div>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stages.length - 1;
            const isMoving = loadingStageId === stage.id;

            return (
              <div
                key={stage.id}
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs hover:border-slate-300 transition-all gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Order indicator */}
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-xs font-bold text-slate-700 shrink-0">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {stage.name}
                      </span>
                      {stage.active ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    {stage.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5 max-w-md">
                        {stage.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {canUpdate && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isFirst || isMoving}
                        onClick={() => handleMove(stage.id, "up")}
                        title="Move Up"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isLast || isMoving}
                        onClick={() => handleMove(stage.id, "down")}
                        title="Move Down"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingStage(stage)}
                        title="Edit Stage"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}

                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setArchivingStage(stage)}
                      title="Archive Stage"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Stage Dialog */}
      <EditStageDialog
        pipelineId={pipelineId}
        stage={editingStage}
        open={!!editingStage}
        onOpenChange={(val) => {
          if (!val) setEditingStage(null);
        }}
      />

      {/* Archive Stage Confirmation Dialog */}
      <Dialog
        open={!!archivingStage}
        onOpenChange={(val) => {
          if (!val) setArchivingStage(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Stage</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <strong className="text-slate-900">{archivingStage?.name}</strong>
              ? It will be safely removed from this pipeline without deleting history.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchivingStage(null)}
              disabled={archiveLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {archiveLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Archive Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
