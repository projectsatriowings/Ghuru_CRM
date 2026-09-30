"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveCustomFieldAction } from "@/lib/actions/custom-field.actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CustomFieldDefinition } from "@/lib/types/custom-fields";
import { Loader2, Archive, AlertCircle } from "lucide-react";

interface ArchiveCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
}

export function ArchiveCustomFieldDialog({
  open,
  onOpenChange,
  field,
}: ArchiveCustomFieldDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!field) return null;

  async function handleArchive() {
    if (!field || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await archiveCustomFieldAction(field.id);
      if (!res.success) {
        setError(res.error || "Failed to archive custom field");
        setLoading(false);
        return;
      }

      onOpenChange(false);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Archive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Archive this custom field?
              </DialogTitle>
              <p className="text-xs text-slate-500 font-medium">
                Field: <span className="text-slate-800 font-semibold">{field.label}</span> ({field.key})
              </p>
            </div>
          </div>
          <DialogDescription className="text-xs text-slate-500 pt-2">
            Existing values will be preserved, but this field will no longer appear in active forms.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 my-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter className="pt-4 gap-2">
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
            className="h-9 px-4 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm"
          >
            {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Archive field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
