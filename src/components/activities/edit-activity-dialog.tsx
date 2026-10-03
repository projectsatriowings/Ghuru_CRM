"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateActivityAction } from "@/lib/actions/activity.actions";
import { updateActivitySchema } from "@/lib/validations/activity";
import { formatZodError } from "@/lib/validations/helpers";
import { ACTIVITY_TYPES, type ActivityType } from "@/db/schema/activities";
import { ACTIVITY_TYPE_LABELS, type ActivityWithRelations } from "@/lib/types/activities";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, Edit2 } from "lucide-react";
import { ActivityIcon } from "./activity-icon";

interface EditActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityWithRelations | null;
  leadId: string;
  onSuccess?: () => void;
}

function EditActivityFormContent({
  activity,
  leadId,
  onClose,
  onSuccess,
}: {
  activity: ActivityWithRelations;
  leadId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [type, setType] = useState<ActivityType>(activity.type);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = updateActivitySchema.safeParse({
      type,
      title,
      description,
    });

    if (!validation.success) {
      setError(formatZodError(validation.error));
      return;
    }

    setLoading(true);

    try {
      const res = await updateActivityAction(
        activity.id,
        leadId,
        validation.data
      );

      if (!res.success) {
        setError(res.error || "Failed to update activity.");
        setLoading(false);
        return;
      }

      onClose();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label
          htmlFor="editActivityType"
          className="text-xs font-semibold text-slate-700"
        >
          Activity Type <span className="text-red-500">*</span>
        </Label>
        <Select
          value={type}
          onValueChange={(val) => setType(val as ActivityType)}
          disabled={loading}
        >
          <SelectTrigger id="editActivityType" className="h-9 text-xs bg-white">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">
                <div className="flex items-center gap-2">
                  <ActivityIcon type={t} className="h-3.5 w-3.5 text-slate-500" />
                  <span>{ACTIVITY_TYPE_LABELS[t]}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="editActivityTitle"
          className="text-xs font-semibold text-slate-700"
        >
          Title <span className="text-red-500">*</span>
        </Label>
        <Input
          id="editActivityTitle"
          placeholder="e.g. Discussed Full Stack course"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          className="h-9 text-xs bg-white"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label
          htmlFor="editActivityDescription"
          className="text-xs font-semibold text-slate-700"
        >
          Description <span className="text-slate-400 font-normal">(optional)</span>
        </Label>
        <textarea
          id="editActivityDescription"
          rows={3}
          placeholder="e.g. Discussed course details and weekend batch."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
        />
      </div>

      <DialogFooter className="pt-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="h-9 px-4 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
        >
          {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditActivityDialog({
  open,
  onOpenChange,
  activity,
  leadId,
  onSuccess,
}: EditActivityDialogProps) {
  if (!activity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-blue-600" />
            <span>Edit Activity</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update activity type, title, or description.
          </DialogDescription>
        </DialogHeader>

        <EditActivityFormContent
          key={activity.id}
          activity={activity}
          leadId={leadId}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
