"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateCustomFieldDialog } from "./create-custom-field-dialog";
import { EditCustomFieldDialog } from "./edit-custom-field-dialog";
import { ArchiveCustomFieldDialog } from "./archive-custom-field-dialog";
import { reorderCustomFieldsAction } from "@/lib/actions/custom-field.actions";
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  FIELD_TYPE_LABELS,
  type CustomFieldDefinition,
} from "@/lib/types/custom-fields";
import {
  Search,
  X,
  MoreHorizontal,
  Edit2,
  Archive,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  AlertCircle,
} from "lucide-react";

interface CustomFieldsTableProps {
  fields: CustomFieldDefinition[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CustomFieldsTable({
  fields,
  canCreate,
  canUpdate,
  canDelete,
}: CustomFieldsTableProps) {
  const router = useRouter();
  const [selectedEntity, setSelectedEntity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingField, setEditingField] =
    useState<CustomFieldDefinition | null>(null);
  const [archivingField, setArchivingField] =
    useState<CustomFieldDefinition | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const filteredFields = useMemo(() => {
    return fields.filter((f) => {
      // Entity filter
      if (selectedEntity !== "all" && f.entityType !== selectedEntity) {
        return false;
      }
      // Status filter
      if (selectedStatus === "active" && !f.active) {
        return false;
      }
      if (selectedStatus === "archived" && f.active) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchLabel = f.label.toLowerCase().includes(q);
        const matchKey = f.key.toLowerCase().includes(q);
        const matchDesc = f.description?.toLowerCase().includes(q);
        const matchType = (FIELD_TYPE_LABELS[f.fieldType] || "")
          .toLowerCase()
          .includes(q);
        if (!matchLabel && !matchKey && !matchDesc && !matchType) {
          return false;
        }
      }
      return true;
    });
  }, [fields, selectedEntity, selectedStatus, searchQuery]);

  async function handleMoveOrder(
    fieldToMove: CustomFieldDefinition,
    direction: "up" | "down"
  ) {
    if (reordering) return;
    setReorderError(null);

    // Get all fields in the same entity, ordered by displayOrder
    const entityFields = fields
      .filter((f) => f.entityType === fieldToMove.entityType)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const currentIndex = entityFields.findIndex((f) => f.id === fieldToMove.id);
    if (currentIndex === -1) return;

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= entityFields.length) return;

    // Swap positions
    const newOrder = [...entityFields];
    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    setReordering(true);
    try {
      const res = await reorderCustomFieldsAction({
        entityType: fieldToMove.entityType,
        orderedFieldIds: newOrder.map((f) => f.id),
      });

      if (!res.success) {
        setReorderError(res.error || "Failed to update display order.");
      }
      setReordering(false);
      router.refresh();
    } catch (err: unknown) {
      setReorderError(
        err instanceof Error ? err.message : "Failed to update display order."
      );
      setReordering(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Custom fields
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure the fields your organization uses across its workspace.
          </p>
        </div>
        {canCreate && <CreateCustomFieldDialog />}
      </div>

      {reorderError && (
        <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{reorderError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search fields..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Entity Filter */}
          <div className="w-full sm:w-36">
            <Select
              value={selectedEntity}
              onValueChange={(val) => {
                if (val) setSelectedEntity(val);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="All entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All entities
                </SelectItem>
                {ENTITY_TYPES.map((et) => (
                  <SelectItem key={et} value={et} className="text-xs">
                    {ENTITY_TYPE_LABELS[et]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-32">
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                if (val) setSelectedStatus(val);
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All status
                </SelectItem>
                <SelectItem value="active" className="text-xs">
                  Active
                </SelectItem>
                <SelectItem value="archived" className="text-xs">
                  Archived
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Count Pill */}
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-1 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
            {filteredFields.length}
          </span>
          <span>{filteredFields.length === 1 ? "field" : "fields"}</span>
        </div>
      </div>

      {/* Fields Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pl-6">
                Field
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Key
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Entity
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Type
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Required
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-slate-500 py-3.5 pr-6 text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {filteredFields.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-44 text-center text-slate-500 text-sm"
                >
                  <div className="flex flex-col items-center justify-center gap-2 py-6">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    {fields.length === 0 ? (
                      <>
                        <p className="font-semibold text-slate-800 text-sm">
                          No custom fields yet.
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Create your first custom field to extend your workspace with business-specific data.
                        </p>
                        {canCreate && (
                          <div className="pt-2">
                            <CreateCustomFieldDialog />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="font-semibold text-slate-800 text-sm">
                          No matching custom fields.
                        </p>
                        <p className="text-xs text-slate-400">
                          Try adjusting your search query or filters.
                        </p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredFields.map((field) => {
                const entityLabel =
                  ENTITY_TYPE_LABELS[field.entityType] || field.entityType;
                const typeLabel =
                  FIELD_TYPE_LABELS[field.fieldType] || field.fieldType;

                return (
                  <TableRow
                    key={field.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Field Column */}
                    <TableCell className="py-3.5 pl-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 text-sm">
                          {field.label}
                        </span>
                        {field.description && (
                          <span className="text-xs text-slate-400 line-clamp-1">
                            {field.description}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Key Column */}
                    <TableCell className="py-3.5">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {field.key}
                      </span>
                    </TableCell>

                    {/* Entity Column */}
                    <TableCell className="py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
                        {entityLabel}
                      </span>
                    </TableCell>

                    {/* Type Column */}
                    <TableCell className="py-3.5 text-xs text-slate-600 font-medium">
                      {typeLabel}
                    </TableCell>

                    {/* Required Column */}
                    <TableCell className="py-3.5">
                      {field.required ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                          No
                        </span>
                      )}
                    </TableCell>

                    {/* Status Column */}
                    <TableCell className="py-3.5">
                      {field.active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                          Archived
                        </span>
                      )}
                    </TableCell>

                    {/* Actions Column */}
                    <TableCell className="py-3.5 pr-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canUpdate && (
                          <div className="hidden sm:flex items-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveOrder(field, "up")}
                              disabled={reordering}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              title="Move up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMoveOrder(field, "down")}
                              disabled={reordering}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                              title="Move down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {canUpdate || canDelete ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-44 p-1 rounded-xl shadow-lg border-slate-200"
                            >
                              {canUpdate && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => setEditingField(field)}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-slate-700 rounded-lg cursor-pointer hover:bg-slate-50"
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Edit</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleMoveOrder(field, "up")}
                                    disabled={reordering}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 sm:hidden"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Move up</span>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem
                                    onClick={() => handleMoveOrder(field, "down")}
                                    disabled={reordering}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 sm:hidden"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5 text-slate-400" />
                                    <span>Move down</span>
                                  </DropdownMenuItem>
                                </>
                              )}

                              {canDelete && field.active && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-100" />
                                  <DropdownMenuItem
                                    onClick={() => setArchivingField(field)}
                                    className="flex items-center gap-2 px-2.5 py-2 text-xs text-amber-600 rounded-lg cursor-pointer hover:bg-amber-50 hover:text-amber-700"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                    <span>Archive field</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Read-only
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <EditCustomFieldDialog
        open={!!editingField}
        onOpenChange={(open) => !open && setEditingField(null)}
        field={editingField}
      />

      {/* Archive Confirmation Dialog */}
      <ArchiveCustomFieldDialog
        open={!!archivingField}
        onOpenChange={(open) => !open && setArchivingField(null)}
        field={archivingField}
      />
    </div>
  );
}
