"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveAutomationAction,
  restoreAutomationAction,
} from "@/lib/actions/automation.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type AutomationWithRelations } from "@/lib/types/automations";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

interface ArchiveAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: AutomationWithRelations | { id: string; name: string } | null;
  mode?: "archive" | "restore";
  onSuccess?: () => void;
}

export function ArchiveAutomationDialog({
  open,
  onOpenChange,
  automation,
  mode = "archive",
  onSuccess,
}: ArchiveAutomationDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!automation) return null;

  const isArchive = mode === "archive";

  async function handleConfirm() {
    if (!automation || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = isArchive
        ? await archiveAutomationAction(automation.id)
        : await restoreAutomationAction(automation.id);

      if (!res.success) {
        setError(res.error || `Failed to ${mode} automation.`);
        setLoading(false);
        return;
      }

      onOpenChange(false);
      router.refresh();
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      setError(
        `An unexpected error occurred while trying to ${mode} this automation.`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                isArchive
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isArchive ? (
                <Archive className="h-5 w-5" />
              ) : (
                <RotateCcw className="h-5 w-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-slate-900">
                {isArchive ? "Archive Automation" : "Restore Automation"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {isArchive
                  ? "Archived automations will immediately stop executing."
                  : "Restoring makes this automation visible and active again."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 text-xs text-slate-600">
          {isArchive ? (
            <p>
              Are you sure you want to archive{" "}
              <strong className="text-slate-900">{automation.name}</strong>?
              Past execution history will be preserved, but no new executions
              will be triggered.
            </p>
          ) : (
            <p>
              Are you sure you want to restore{" "}
              <strong className="text-slate-900">{automation.name}</strong>? It
              will re-appear in the active automations list.
            </p>
          )}

          {error && (
            <p className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-md border border-rose-200">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isArchive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isArchive ? "Archive Automation" : "Restore Automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
