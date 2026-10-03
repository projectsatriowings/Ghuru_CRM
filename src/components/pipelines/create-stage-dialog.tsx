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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { createStageAction } from "@/lib/actions/pipeline.actions";

interface CreateStageDialogProps {
  pipelineId: string;
}

export function CreateStageDialog({ pipelineId }: CreateStageDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setActive(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Stage name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createStageAction(pipelineId, {
        name: name.trim(),
        description: description.trim() || undefined,
        active,
      });

      if (!res.success) {
        setError(res.error || "Failed to create stage.");
        return;
      }

      resetForm();
      setOpen(false);
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
    <Dialog
      open={open}
      onOpenChange={(val) => {
        setOpen(val);
        if (!val) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <Plus className="h-4 w-4" />
          <span>Add Stage</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Pipeline Stage</DialogTitle>
            <DialogDescription>
              Add a new stage to this pipeline. New stages are appended sequentially.
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
              <Label htmlFor="stage-name">
                Stage Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="stage-name"
                placeholder="e.g., Counselling, Demo, Fee Pending"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="stage-description">Description (Optional)</Label>
              <textarea
                id="stage-description"
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
                id="stage-active"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <Label htmlFor="stage-active" className="text-sm font-medium cursor-pointer">
                Active (stage is currently enabled)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
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
              Add Stage
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
