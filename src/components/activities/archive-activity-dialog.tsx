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
  leadId: string;
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
        <DialogHeader className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/80">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            Archive Activity
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to archive this activity record?
            <span className="block font-semibold text-slate-800 mt-1">
              &quot;{activity.title}&quot;
            </span>
            It will be removed from the main timeline view while preserving historical data.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <DialogFooter className="pt-3 gap-2">
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
