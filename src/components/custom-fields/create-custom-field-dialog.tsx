"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomFieldAction } from "@/lib/actions/custom-field.actions";
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
import { OptionsEditor } from "./options-editor";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type EntityType,
  type FieldType,
  type SelectOption,
} from "@/lib/types/custom-fields";
import { Plus, Loader2, AlertCircle } from "lucide-react";

export function CreateCustomFieldDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("lead");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [active, setActive] = useState(true);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newLabel = e.target.value;
    setLabel(newLabel);
    if (!keyManuallyEdited) {
      const generated = newLabel
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setKey(generated);
    }
  }

  function handleKeyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setKeyManuallyEdited(true);
    setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
  }

  function resetForm() {
    setLabel("");
    setKey("");
    setKeyManuallyEdited(false);
    setEntityType("lead");
    setFieldType("text");
    setDescription("");
    setRequired(false);
    setActive(true);
    setOptions([]);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (fieldType === "select" || fieldType === "multiselect") {
      if (options.length === 0) {
        setError(
          `${
            fieldType === "select" ? "Dropdown" : "Multi-select"
          } fields require at least one option.`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const res = await createCustomFieldAction({
        entityType,
        label,
        key,
        fieldType,
        description: description.trim() || null,
        required,
        active,
        config:
          fieldType === "select" || fieldType === "multiselect"
            ? { options }
            : {},
      });

      if (!res.success) {
        setError(res.error || "Failed to create custom field");
        setLoading(false);
        return;
      }

      setOpen(false);
      resetForm();
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  }

  const isOptionField = fieldType === "select" || fieldType === "multiselect";

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-9 px-3.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm gap-2 transition-colors">
          <Plus className="h-3.5 w-3.5" />
          <span>Create field</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-6 rounded-2xl shadow-xl border-slate-200">
        <DialogHeader className="space-y-1.5 pb-2 shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900">
            Create custom field
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Define a new organization-scoped custom field for your workspace entities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4 pt-1">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200 shrink-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Entity and Field Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="entityType" className="text-xs font-semibold text-slate-700">
                  Entity <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={entityType}
                  onValueChange={(val) => {
                    if (val) setEntityType(val as EntityType);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger id="entityType" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((et) => (
                      <SelectItem key={et} value={et} className="text-xs">
                        {ENTITY_TYPE_LABELS[et]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fieldType" className="text-xs font-semibold text-slate-700">
                  Field type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={fieldType}
                  onValueChange={(val) => {
                    if (val) {
                      const ft = val as FieldType;
                      setFieldType(ft);
                      if (ft !== "select" && ft !== "multiselect") {
                        setOptions([]);
                      }
                    }
                  }}
                  disabled={loading}
                >
                  <SelectTrigger id="fieldType" className="h-9 text-xs bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft} value={ft} className="text-xs">
                        {FIELD_TYPE_LABELS[ft]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Label and Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fieldLabel" className="text-xs font-semibold text-slate-700">
                  Field label <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fieldLabel"
                  placeholder="e.g. Career Goal"
                  value={label}
                  onChange={handleLabelChange}
                  disabled={loading}
                  required
                  className="h-9 text-xs bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fieldKey" className="text-xs font-semibold text-slate-700">
                  Field key <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fieldKey"
                  placeholder="career_goal"
                  value={key}
                  onChange={handleKeyChange}
                  disabled={loading}
                  required
                  className="h-9 text-xs font-mono bg-white"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="fieldDesc" className="text-xs font-semibold text-slate-700">
                Description
              </Label>
              <Input
                id="fieldDesc"
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
              onClick={() => setOpen(false)}
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
              Create field
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
