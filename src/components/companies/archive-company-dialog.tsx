"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  archiveCompanyAction,
  restoreCompanyAction,
} from "@/lib/actions/company.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type Company } from "@/lib/types/companies";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

interface ArchiveCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company | null;
  mode?: "archive" | "restore";
  onSuccess?: () => void;
}

export function ArchiveCompanyDialog({
  open,
  onOpenChange,
  company,
  mode = "archive",
  onSuccess,
}: ArchiveCompanyDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!company) return null;

  const isArchive = mode === "archive";

  async function handleConfirm() {
    if (!company || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = isArchive
        ? await archiveCompanyAction(company.id)
        : await restoreCompanyAction(company.id);

      if (!res.success) {
        setError(res.error || `Failed to ${mode} company.`);
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
        err instanceof Error ? err.message : `Failed to ${mode} company.`
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
            {isArchive
              ? `Archive company: ${company.name}`
              : `Restore company: ${company.name}`}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 leading-relaxed">
            {isArchive
              ? "Archiving will hide this company from your default active list. Company details, notes, and custom field values will be preserved and can be restored at any time."
              : "Restoring will move this company back into your active companies list with all its original details and custom field values."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`text-xs font-medium rounded-lg text-white ${
              isArchive
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {isArchive ? "Archive Company" : "Restore Company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
