"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createActivityAction } from "@/lib/actions/activity.actions";
import { createActivitySchema } from "@/lib/validations/activity";
import { formatZodError } from "@/lib/validations/helpers";
import { ACTIVITY_TYPES, type ActivityType } from "@/db/schema/activities";
import { ACTIVITY_TYPE_LABELS } from "@/lib/types/activities";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { ActivityIcon } from "./activity-icon";

interface AddActivityDialogProps {
  leadId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddActivityDialog({
  leadId,
  trigger,
  onSuccess,
}: AddActivityDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ActivityType>("call");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = createActivitySchema.safeParse({
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
      const res = await createActivityAction(leadId, validation.data);

      if (!res.success) {
        setError(res.error || "Failed to log activity.");
        setLoading(false);
        return;
      }

      setOpen(false);
      setTitle("");
      setDescription("");
      setType("call");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="h-8 px-3 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            <span>Add Activity</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1 pb-2">
          <DialogTitle className="text-base font-bold text-slate-900">
            Add Activity
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Log an interaction or record for this lead.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label
              htmlFor="activityType"
              className="text-xs font-semibold text-slate-700"
            >
              Activity Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(val) => setType(val as ActivityType)}
              disabled={loading}
            >
              <SelectTrigger id="activityType" className="h-9 text-xs bg-white">
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
              htmlFor="activityTitle"
              className="text-xs font-semibold text-slate-700"
            >
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="activityTitle"
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
              htmlFor="activityDescription"
              className="text-xs font-semibold text-slate-700"
            >
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <textarea
              id="activityDescription"
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
              onClick={() => setOpen(false)}
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
              Save Activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
