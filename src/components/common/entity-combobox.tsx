"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, Search, X, Loader2 } from "lucide-react";

export interface ComboboxOption {
  id: string;
  name: string;
  subtext?: string;
}

interface EntityComboboxProps {
  value: string | null | undefined;
  onChange: (value: string | null, option?: ComboboxOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  clearLabel?: string;
  fetchOptions?: (search: string) => Promise<ComboboxOption[]>;
  initialOptions?: ComboboxOption[];
  disabled?: boolean;
}

export function EntityCombobox({
  value,
  onChange,
  placeholder = "Select an item...",
  searchPlaceholder = "Search...",
  emptyText = "No items found.",
  allowClear = true,
  clearLabel = "None",
  fetchOptions,
  initialOptions = [],
  disabled = false,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<ComboboxOption[] | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = searchResults !== null ? searchResults : initialOptions;

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (!val.trim()) {
      setSearchResults(null);
    }
  };

  // Debounced search when fetchOptions is provided
  useEffect(() => {
    if (!fetchOptions || !search.trim()) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptions(search);
        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (err) {
        console.error("Failed to fetch options in combobox", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, fetchOptions]);

  const selectedOption =
    options.find((opt) => opt.id === value) ||
    initialOptions.find((opt) => opt.id === value);

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        onClick={() => {
          if (!disabled) {
            setOpen((prev) => !prev);
          }
        }}
        className={`flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${
          disabled ? "opacity-50 pointer-events-none" : ""
        }`}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={open}
        aria-controls="combobox-options-list"
      >
        <span
          className={`truncate ${
            !selectedOption ? "text-muted-foreground" : "font-medium"
          }`}
        >
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <div className="flex items-center gap-1 text-muted-foreground">
          {allowClear && value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
                setSearch("");
                setSearchResults(null);
              }}
              className="rounded-full p-0.5 hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </div>
      </div>

      {open && (
        <div
          id="combobox-options-list"
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <div className="flex items-center border-b px-2.5 py-1.5 bg-muted/20">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 shadow-none"
              autoFocus
            />
            {loading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>

          <div className="max-h-48 overflow-y-auto p-1 text-sm">
            {allowClear && (
              <div
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`flex items-center justify-between rounded-sm px-2 py-1.5 cursor-pointer text-muted-foreground hover:bg-accent hover:text-accent-foreground ${
                  !value ? "bg-accent/50 font-medium" : ""
                }`}
              >
                <span>{clearLabel}</span>
                {!value && <Check className="h-4 w-4 text-primary" />}
              </div>
            )}

            {options.length === 0 && !loading && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                {emptyText}
              </div>
            )}

            {options.map((opt) => {
              const isSelected = opt.id === value;
              return (
                <div
                  key={opt.id}
                  onClick={() => {
                    onChange(opt.id, opt);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-between rounded-sm px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground ${
                    isSelected
                      ? "bg-accent text-accent-foreground font-medium"
                      : ""
                  }`}
                >
                  <div className="flex flex-col truncate">
                    <span className="truncate">{opt.name}</span>
                    {opt.subtext && (
                      <span className="text-xs text-muted-foreground truncate">
                        {opt.subtext}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
