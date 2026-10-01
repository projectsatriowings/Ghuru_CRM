"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveLeadAction,
  restoreLeadAction,
} from "@/lib/actions/lead.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Lead } from "@/lib/types/leads";
import { AlertTriangle, Archive, RotateCcw, Loader2 } from "lucide-react";

interface ArchiveLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  mode?: "archive" | "restore";
  onSuccess?: () => void;
}

export function ArchiveLeadDialog({
  open,
  onOpenChange,
  lead,
  mode = "archive",
  onSuccess,
}: ArchiveLeadDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!lead) return null;

  const isArchive = mode === "archive";
  const fullName = `${lead.firstName} ${lead.lastName || ""}`.trim();

  async function handleConfirm() {
    if (!lead || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = isArchive
        ? await archiveLeadAction(lead.id)
        : await restoreLeadAction(lead.id);

      if (!res.success) {
        setError(res.error || `Failed to ${mode} lead.`);
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
        err instanceof Error ? err.message : `Failed to ${mode} lead.`
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isArchive
                ? "bg-amber-50 text-amber-600 border border-amber-200"
                : "bg-blue-50 text-blue-600 border border-blue-200"
            }`}
          >
            {isArchive ? (
              <Archive className="h-5 w-5" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )}
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">
            {isArchive ? `Archive lead: ${fullName}` : `Restore lead: ${fullName}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {isArchive
              ? "Archiving will hide this lead from your default active list. All prospect details, notes, and custom field values will be preserved and can be restored at any time."
              : "Restoring will move this lead back into your active leads list with all its original prospect details and custom field values."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-slate-100 gap-2">
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
            onClick={handleConfirm}
            disabled={loading}
            className={`h-9 px-4 text-xs font-medium rounded-lg text-white shadow-sm ${
              isArchive
                ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
            }`}
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {isArchive ? "Archive Lead" : "Restore Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
