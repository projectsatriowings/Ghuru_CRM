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
import { createPipelineAction } from "@/lib/actions/pipeline.actions";

export function CreatePipelineDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIsDefault(false);
    setActive(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Pipeline name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createPipelineAction({
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
        active,
      });

      if (!res.success) {
        setError(res.error || "Failed to create pipeline.");
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
          <span>Create Pipeline</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Pipeline</DialogTitle>
            <DialogDescription>
              Define a new sales, admissions, or business journey for your leads.
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
              <Label htmlFor="pipeline-name">
                Pipeline Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="pipeline-name"
                placeholder="e.g., Admissions Pipeline, Sales Pipeline"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline-description">Description (Optional)</Label>
              <textarea
                id="pipeline-description"
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
                  id="pipeline-default"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="pipeline-default" className="text-sm font-medium cursor-pointer">
                  Set as default pipeline for new leads
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="pipeline-active"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="pipeline-active" className="text-sm font-medium cursor-pointer">
                  Active (available for use)
                </Label>
              </div>
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
              Create Pipeline
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
