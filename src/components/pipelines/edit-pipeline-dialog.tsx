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
import { updatePipelineAction } from "@/lib/actions/pipeline.actions";
import { type Pipeline } from "@/lib/types/pipelines";

interface EditPipelineDialogProps {
  pipeline: Pipeline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditPipelineDialog({
  pipeline,
  open,
  onOpenChange,
}: EditPipelineDialogProps) {
  const router = useRouter();
  const [name, setName] = useState(pipeline?.name || "");
  const [description, setDescription] = useState(pipeline?.description || "");
  const [isDefault, setIsDefault] = useState(pipeline?.isDefault || false);
  const [active, setActive] = useState(pipeline?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync state when pipeline changes
  const handleOpenChange = (val: boolean) => {
    if (val && pipeline) {
      setName(pipeline.name);
      setDescription(pipeline.description || "");
      setIsDefault(pipeline.isDefault);
      setActive(pipeline.active);
      setError(null);
    }
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipeline) return;
    if (!name.trim()) {
      setError("Pipeline name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await updatePipelineAction(pipeline.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
        active,
      });

      if (!res.success) {
        setError(res.error || "Failed to update pipeline.");
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
            <DialogTitle>Edit Pipeline</DialogTitle>
            <DialogDescription>
              Update pipeline details, default status, and availability.
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
              <Label htmlFor="edit-pipeline-name">
                Pipeline Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-pipeline-name"
                placeholder="e.g., Admissions Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-pipeline-description">Description (Optional)</Label>
              <textarea
                id="edit-pipeline-description"
                className="w-full min-h-[80px] p-2.5 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                placeholder="Explain the purpose of this pipeline..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-pipeline-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="edit-pipeline-default" className="text-sm font-medium cursor-pointer">
                  Set as default pipeline
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-pipeline-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="edit-pipeline-active" className="text-sm font-medium cursor-pointer">
                  Active (available for use)
                </Label>
              </div>
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
