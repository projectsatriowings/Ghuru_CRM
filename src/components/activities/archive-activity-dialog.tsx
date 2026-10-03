"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveActivityAction } from "@/lib/actions/activity.actions";
import { type ActivityWithRelations } from "@/lib/types/activities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";

interface ArchiveActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityWithRelations | null;
  leadId?: string;
  onSuccess?: () => void;
}

export function ArchiveActivityDialog({
  open,
  onOpenChange,
  activity,
  leadId,
  onSuccess,
}: ArchiveActivityDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!activity) return null;

  async function handleArchive() {
    if (!activity) return;
    setError(null);
    setLoading(true);

    try {
      const res = await archiveActivityAction(activity.id, leadId);

      if (!res.success) {
        setError(res.error || "Failed to archive activity.");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);

      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle className="text-base font-bold text-slate-900">
              Archive Activity
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Are you sure you want to archive this activity? It will be removed
            from the active timeline view.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">{activity.title}</p>
          {activity.description && (
            <p className="text-slate-500 mt-1 line-clamp-2">
              {activity.description}
            </p>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-9 px-4 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleArchive}
            disabled={loading}
            className="h-9 px-4 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Archive Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
