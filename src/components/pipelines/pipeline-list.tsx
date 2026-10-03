"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GitBranch,
  MoreHorizontal,
  Edit2,
  Archive,
  Star,
  CheckCircle2,
  ArrowRight,
  Layers,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CreatePipelineDialog } from "./create-pipeline-dialog";
import { EditPipelineDialog } from "./edit-pipeline-dialog";
import {
  archivePipelineAction,
  setDefaultPipelineAction,
} from "@/lib/actions/pipeline.actions";
import { type PipelineWithCount, type Pipeline } from "@/lib/types/pipelines";

interface PipelineListProps {
  pipelines: PipelineWithCount[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function PipelineList({
  pipelines,
  canCreate,
  canUpdate,
  canDelete,
}: PipelineListProps) {
  const router = useRouter();
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const [archivingPipeline, setArchivingPipeline] = useState<PipelineWithCount | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSetDefault = async (pipeline: PipelineWithCount) => {
    setActionError(null);
    try {
      const res = await setDefaultPipelineAction(pipeline.id);
      if (!res.success) {
        setActionError(res.error || "Failed to set default pipeline.");
        return;
      }
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to set default pipeline."
      );
    }
  };

  const handleArchive = async () => {
    if (!archivingPipeline) return;
    setArchiveLoading(true);
    setActionError(null);

    try {
      const res = await archivePipelineAction(archivingPipeline.id);
      if (!res.success) {
        setActionError(res.error || "Failed to archive pipeline.");
        return;
      }
      setArchivingPipeline(null);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to archive pipeline."
      );
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header section with Create button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Organization Pipelines
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure custom stages and journeys for different lead pathways.
          </p>
        </div>
        {canCreate && <CreatePipelineDialog />}
      </div>

      {pipelines.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-300">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <GitBranch className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No pipelines configured yet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Create your first pipeline to define customer journeys, admission
            stages, or sales processes.
          </p>
          {canCreate && <CreatePipelineDialog />}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">Pipeline</TableHead>
                <TableHead className="font-semibold text-slate-700">Stages</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pipelines.map((pipeline) => (
                <TableRow key={pipeline.id} className="hover:bg-slate-50/50">
                  <TableCell className="align-top py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/settings/pipelines/${pipeline.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 hover:underline"
                        >
                          {pipeline.name}
                        </Link>
                        {pipeline.isDefault && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1 font-medium"
                          >
                            <Star className="h-3 w-3 fill-blue-600 text-blue-600" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {pipeline.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 max-w-md">
                          {pipeline.description}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="align-top py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Layers className="h-4 w-4 text-slate-400" />
                      <span>{pipeline.stageCount} {pipeline.stageCount === 1 ? "stage" : "stages"}</span>
                    </div>
                  </TableCell>

                  <TableCell className="align-top py-4">
                    {pipeline.active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Inactive
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right align-top py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/settings/pipelines/${pipeline.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs text-slate-700 hover:text-blue-600"
                        >
                          <span>Manage Stages</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {(canUpdate || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {canUpdate && (
                              <DropdownMenuItem
                                onClick={() => setEditingPipeline(pipeline)}
                                className="gap-2 cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4 text-slate-500" />
                                <span>Edit Details</span>
                              </DropdownMenuItem>
                            )}

                            {canUpdate && !pipeline.isDefault && (
                              <DropdownMenuItem
                                onClick={() => handleSetDefault(pipeline)}
                                className="gap-2 cursor-pointer"
                              >
                                <CheckCircle2 className="h-4 w-4 text-slate-500" />
                                <span>Set as Default</span>
                              </DropdownMenuItem>
                            )}

                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setArchivingPipeline(pipeline)}
                                  className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                >
                                  <Archive className="h-4 w-4" />
                                  <span>Archive</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Pipeline Dialog */}
      <EditPipelineDialog
        pipeline={editingPipeline}
        open={!!editingPipeline}
        onOpenChange={(val) => {
          if (!val) setEditingPipeline(null);
        }}
      />

      {/* Archive Pipeline Confirmation Dialog */}
      <Dialog
        open={!!archivingPipeline}
        onOpenChange={(val) => {
          if (!val) setArchivingPipeline(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive Pipeline</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive{" "}
              <strong className="text-slate-900">
                {archivingPipeline?.name}
              </strong>
              ? It will be safely removed from active views without destroying history.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchivingPipeline(null)}
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
              Archive Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
