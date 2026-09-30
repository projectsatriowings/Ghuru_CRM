"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCustomFieldAction } from "@/lib/actions/custom-field.actions";
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
import { OptionsEditor } from "./options-editor";
import {
  ENTITY_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  type CustomFieldDefinition,
  type SelectOption,
} from "@/lib/types/custom-fields";
import { Loader2, AlertCircle } from "lucide-react";

interface EditCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
}

function EditCustomFieldFormContent({
  field,
  onClose,
}: {
  field: CustomFieldDefinition;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(field.label);
  const [description, setDescription] = useState(field.description || "");
  const [required, setRequired] = useState(field.required);
  const [active, setActive] = useState(field.active);
  const [displayOrder] = useState(field.displayOrder);
  const [options, setOptions] = useState<SelectOption[]>(
    (field.config?.options as SelectOption[]) || []
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isOptionField =
    field.fieldType === "select" || field.fieldType === "multiselect";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (isOptionField && options.length === 0) {
      setError(
        `${
          field.fieldType === "select" ? "Dropdown" : "Multi-select"
        } fields require at least one option.`
      );
      return;
    }

    setLoading(true);

    try {
      const res = await updateCustomFieldAction(field.id, {
        label,
        description: description.trim() || null,
        required,
        active,
        displayOrder,
        config: isOptionField ? { ...field.config, options } : field.config,
      });

      if (!res.success) {
        setError(res.error || "Failed to update custom field");
        setLoading(false);
        return;
      }

      onClose();
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
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 pt-1">
      {error && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {/* Entity and Field Type (Locked) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">
              Entity
            </Label>
            <div className="h-9 px-3 flex items-center bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
              {ENTITY_TYPE_LABELS[field.entityType]}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">
              Field type
            </Label>
            <div className="h-9 px-3 flex items-center bg-slate-100 rounded-lg border border-slate-200 text-xs font-medium text-slate-700">
              {FIELD_TYPE_LABELS[field.fieldType]}
            </div>
          </div>
        </div>

        {/* Label and Key */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="editFieldLabel" className="text-xs font-semibold text-slate-700">
              Field label <span className="text-red-500">*</span>
            </Label>
            <Input
              id="editFieldLabel"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={loading}
              required
              className="h-9 text-xs bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-600">
              Field key
            </Label>
            <div className="h-9 px-3 flex items-center bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono text-slate-600">
              {field.key}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="editFieldDesc" className="text-xs font-semibold text-slate-700">
            Description
          </Label>
          <Input
            id="editFieldDesc"
            placeholder="Optional helper text or guidance for this field"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
            className="h-9 text-xs bg-white"
          />
        </div>

        {/* Dynamic Options for select / multiselect */}
        {isOptionField && (
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <OptionsEditor
              options={options}
              onChange={setOptions}
              disabled={loading}
            />
          </div>
        )}

        {/* Checkbox Toggles */}
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              disabled={loading}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
            />
            <span className="text-xs font-medium text-slate-700">
              Required field
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={loading}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
            />
            <span className="text-xs font-medium text-slate-700">
              Active in workspace
            </span>
          </label>
        </div>
      </div>

      <DialogFooter className="pt-3 border-t border-slate-100 gap-2 shrink-0">
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
          className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
        >
          {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditCustomFieldDialog({
  open,
  onOpenChange,
  field,
}: EditCustomFieldDialogProps) {
  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Edit custom field: {field.label}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update field settings, options, and visibility across the workspace.
          </DialogDescription>
        </DialogHeader>

        <EditCustomFieldFormContent
          key={field.id}
          field={field}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
