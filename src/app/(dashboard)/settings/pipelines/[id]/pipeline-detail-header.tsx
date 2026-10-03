"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Edit2 } from "lucide-react";
import { EditPipelineDialog } from "@/components/pipelines/edit-pipeline-dialog";
import { type PipelineWithStages } from "@/lib/types/pipelines";

interface PipelineDetailHeaderProps {
  pipeline: PipelineWithStages;
  canUpdate: boolean;
}

export function PipelineDetailHeader({
  pipeline,
  canUpdate,
}: PipelineDetailHeaderProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">
              {pipeline.name}
            </h2>
            {pipeline.isDefault && (
              <Badge
                variant="secondary"
                className="bg-blue-50 text-blue-700 border-blue-200 text-xs gap-1 font-medium"
              >
                <Star className="h-3 w-3 fill-blue-600 text-blue-600" />
                Default
              </Badge>
            )}
            {pipeline.active ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                Inactive
              </span>
            )}
          </div>
          {pipeline.description ? (
            <p className="text-sm text-slate-600 max-w-2xl">
              {pipeline.description}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No description provided.
            </p>
          )}
        </div>

        {canUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
            className="gap-2 shrink-0 border-slate-300 text-slate-700 hover:text-blue-600"
          >
            <Edit2 className="h-4 w-4" />
            <span>Edit Pipeline</span>
          </Button>
        )}
      </div>

      <EditPipelineDialog
        pipeline={pipeline}
        open={editing}
        onOpenChange={setEditing}
      />
    </>
  );
}
