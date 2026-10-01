"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CustomFieldDefinition,
  type SelectOption,
} from "@/lib/types/custom-fields";
import { ExternalLink, Mail, Phone, CheckCircle2, XCircle } from "lucide-react";

interface CustomFieldRendererProps {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  disabled?: boolean;
}

export function CustomFieldRenderer({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: CustomFieldRendererProps) {
  const options = (field.config?.options as SelectOption[]) || [];
  const currencyCode = (field.config?.currency as string) || "USD";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={`cf_${field.key}`}
          className="text-xs font-semibold text-slate-700 flex items-center gap-1"
        >
          {field.label}
          {field.required && <span className="text-red-500 font-bold">*</span>}
        </Label>
        {field.description && (
          <span className="text-[11px] text-slate-400 font-normal">
            {field.description}
          </span>
        )}
      </div>

      {/* Render based on fieldType */}
      {(() => {
        switch (field.fieldType) {
          case "text":
            return (
              <Input
                id={`cf_${field.key}`}
                type="text"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="h-9 text-xs bg-white"
              />
            );

          case "textarea":
            return (
              <textarea
                id={`cf_${field.key}`}
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                rows={3}
                placeholder={`Enter ${field.label.toLowerCase()}`}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
              />
            );

          case "number":
            return (
              <Input
                id={`cf_${field.key}`}
                type="number"
                value={value !== undefined && value !== null ? String(value) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(val === "" ? null : Number(val));
                }}
                disabled={disabled}
                placeholder="0"
                className="h-9 text-xs bg-white"
              />
            );

          case "currency":
            return (
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {currencyCode}
                </span>
                <Input
                  id={`cf_${field.key}`}
                  type="number"
                  step="0.01"
                  value={
                    typeof value === "object" && value !== null && "amount" in value
                      ? String((value as { amount: number }).amount)
                      : value !== undefined && value !== null
                      ? String(value)
                      : ""
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    onChange(val === "" ? null : Number(val));
                  }}
                  disabled={disabled}
                  placeholder="0.00"
                  className="h-9 text-xs bg-white pl-12"
                />
              </div>
            );

          case "date":
            return (
              <Input
                id={`cf_${field.key}`}
                type="date"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value || null)}
                disabled={disabled}
                className="h-9 text-xs bg-white"
              />
            );

          case "datetime":
            return (
              <Input
                id={`cf_${field.key}`}
                type="datetime-local"
                value={
                  typeof value === "string"
                    ? value.includes("Z")
                      ? value.slice(0, 16)
                      : value
                    : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onChange(val ? new Date(val).toISOString() : null);
                }}
                disabled={disabled}
                className="h-9 text-xs bg-white"
              />
            );

          case "boolean":
            return (
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    id={`cf_${field.key}`}
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Yes / True
                  </span>
                </label>
              </div>
            );

          case "select":
            return (
              <Select
                value={(value as string) || ""}
                onValueChange={(val) => onChange(val || null)}
                disabled={disabled}
              >
                <SelectTrigger
                  id={`cf_${field.key}`}
                  className="h-9 text-xs bg-white"
                >
                  <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );

          case "multiselect": {
            const currentSelected = Array.isArray(value) ? (value as string[]) : [];
            return (
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="grid grid-cols-2 gap-2">
                  {options.map((opt) => {
                    const isChecked = currentSelected.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onChange([...currentSelected, opt.value]);
                            } else {
                              onChange(
                                currentSelected.filter((v) => v !== opt.value)
                              );
                            }
                          }}
                          disabled={disabled}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-600 h-3.5 w-3.5"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }

          case "email":
            return (
              <Input
                id={`cf_${field.key}`}
                type="email"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="name@example.com"
                className="h-9 text-xs bg-white"
              />
            );

          case "phone":
            return (
              <Input
                id={`cf_${field.key}`}
                type="tel"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="+1 (555) 000-0000"
                className="h-9 text-xs bg-white"
              />
            );

          case "url":
            return (
              <Input
                id={`cf_${field.key}`}
                type="url"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="https://example.com"
                className="h-9 text-xs bg-white"
              />
            );

          default:
            return (
              <Input
                id={`cf_${field.key}`}
                type="text"
                value={(value as string) || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="h-9 text-xs bg-white"
              />
            );
        }
      })()}

      {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}

/**
 * Clean read-only display component for rendered custom field values on detail pages.
 */
export function CustomFieldValueDisplay({
  field,
  value,
}: {
  field: CustomFieldDefinition;
  value: unknown;
}) {
  const isValueEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0);

  if (isValueEmpty) {
    return <span className="text-xs text-slate-400 italic">Not set</span>;
  }

  const options = (field.config?.options as SelectOption[]) || [];
  const currencyCode = (field.config?.currency as string) || "USD";

  switch (field.fieldType) {
    case "text":
      return (
        <span className="text-xs font-medium text-slate-800 break-words">
          {String(value)}
        </span>
      );

    case "textarea":
      return (
        <p className="text-xs font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">
          {String(value)}
        </p>
      );

    case "number":
      return (
        <span className="text-xs font-semibold text-slate-900 font-mono">
          {Number(value).toLocaleString()}
        </span>
      );

    case "currency": {
      const amount =
        typeof value === "object" && value !== null && "amount" in value
          ? (value as { amount: number }).amount
          : Number(value);
      return (
        <span className="text-xs font-semibold text-slate-900 font-mono">
          {currencyCode} {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }

    case "date":
      return (
        <span className="text-xs font-medium text-slate-800">
          {String(value)}
        </span>
      );

    case "datetime": {
      let dateStr = String(value);
      try {
        const d = new Date(String(value));
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleString();
        }
      } catch {
        // fallback
      }
      return (
        <span className="text-xs font-medium text-slate-800">
          {dateStr}
        </span>
      );
    }

    case "boolean":
      return value ? (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-3 w-3" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <XCircle className="h-3 w-3" /> No
        </span>
      );

    case "select": {
      const opt = options.find((o) => o.value === value);
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
          {opt ? opt.label : String(value)}
        </span>
      );
    }

    case "multiselect": {
      const selected = Array.isArray(value) ? value : [value];
      return (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <span
                key={String(val)}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60"
              >
                {opt ? opt.label : String(val)}
              </span>
            );
          })}
        </div>
      );
    }

    case "email":
      return (
        <a
          href={`mailto:${value}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <Mail className="h-3 w-3" />
          {String(value)}
        </a>
      );

    case "phone":
      return (
        <a
          href={`tel:${value}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <Phone className="h-3 w-3" />
          {String(value)}
        </a>
      );

    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {String(value)}
        </a>
      );

    default:
      return <span className="text-xs text-slate-800">{String(value)}</span>;
  }
}
