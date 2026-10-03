"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle } from "lucide-react";
import { updateStageAction } from "@/lib/actions/pipeline.actions";
import { type PipelineStage } from "@/lib/types/pipelines";

interface EditStageDialogProps {
  pipelineId: string;
  stage: PipelineStage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStageDialog({
  pipelineId,
  stage,
  open,
  onOpenChange,
}: EditStageDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(stage?.name || "");
  const [description, setDescription] = useState(stage?.description || "");
  const [active, setActive] = useState(stage?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (val: boolean) => {
    if (val && stage) {
      setName(stage.name);
      setDescription(stage.description || "");
      setActive(stage.active);
      setError(null);
    }
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;
    if (!name.trim()) {
      setError("Stage name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await updateStageAction(pipelineId, stage.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        active,
      });

      if (!res.success) {
        setError(res.error || "Failed to update stage.");
        return;
      }

      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
            <DialogDescription>
              Update stage name, description, and status.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-stage-name">
                Stage Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-stage-name"
                placeholder="e.g., Counselling"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-stage-description">Description (Optional)</Label>
              <textarea
                id="edit-stage-description"
                className="w-full min-h-[80px] p-2.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                placeholder="What happens in this stage..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="edit-stage-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="edit-stage-active" className="text-sm font-medium cursor-pointer">
                Active (stage is currently enabled)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
