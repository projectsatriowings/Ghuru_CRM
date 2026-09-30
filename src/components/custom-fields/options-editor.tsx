"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { SelectOption } from "@/lib/types/custom-fields";

interface OptionsEditorProps {
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
  disabled?: boolean;
}

export function OptionsEditor({
  options,
  onChange,
  disabled = false,
}: OptionsEditorProps) {
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [valueManuallyEdited, setValueManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleLabelChange(text: string) {
    setNewLabel(text);
    if (!valueManuallyEdited) {
      const generated = text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      setNewValue(generated);
    }
  }

  function handleAddOption() {
    setError(null);
    const trimmedLabel = newLabel.trim();
    const trimmedValue = newValue.trim().toLowerCase();

    if (!trimmedLabel) {
      setError("Option label cannot be empty.");
      return;
    }
    if (!trimmedValue) {
      setError("Option value cannot be empty.");
      return;
    }

    // Check duplicate value
    if (options.some((o) => o.value.toLowerCase() === trimmedValue)) {
      setError(`An option with value "${trimmedValue}" already exists.`);
      return;
    }

    onChange([...options, { label: trimmedLabel, value: trimmedValue }]);
    setNewLabel("");
    setNewValue("");
    setValueManuallyEdited(false);
  }

  function handleRemoveOption(indexToRemove: number) {
    onChange(options.filter((_, idx) => idx !== indexToRemove));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700">
          Options <span className="text-red-500">*</span>
        </Label>
        <span className="text-[11px] text-slate-400">
          {options.length} {options.length === 1 ? "option" : "options"} defined
        </span>
      </div>

      {/* List of current options */}
      {options.length > 0 ? (
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-800 truncate">
                  {opt.label}
                </span>
                <span className="font-mono text-[11px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  {opt.value}
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                  title="Remove option"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg text-xs text-amber-800">
          No options added yet. Add at least one option below.
        </div>
      )}

      {/* Add new option inputs */}
      {!disabled && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Input
                placeholder="Option label (e.g. Student)"
                value={newLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                className="h-8 text-xs bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
            </div>
            <div>
              <Input
                placeholder="Value (e.g. student)"
                value={newValue}
                onChange={(e) => {
                  setValueManuallyEdited(true);
                  setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                }}
                className="h-8 text-xs font-mono bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddOption();
                  }
                }}
              />
            </div>
          </div>

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddOption}
            className="w-full h-8 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add option</span>
          </Button>
        </div>
      )}
    </div>
  );
}
