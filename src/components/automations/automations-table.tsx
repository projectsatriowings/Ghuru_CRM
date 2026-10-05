"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  type AutomationWithRelations,
  type AutomationEntityType,
  type AutomationTriggerType,
} from "@/lib/types/automations";
import {
  AutomationStatusBadge,
  ExecutionStatusBadge,
} from "./automation-status-badge";
import { ArchiveAutomationDialog } from "./archive-automation-dialog";
import { toggleAutomationActiveAction } from "@/lib/actions/automation.actions";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  X,
  Plus,
  MoreHorizontal,
  Eye,
  Edit2,
  Archive,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FilterX,
  Zap,
  Briefcase,
  UserPlus,
  Contact,
  Building,
} from "lucide-react";
import { TRIGGER_REGISTRY } from "@/lib/automation/trigger-registry";

interface AutomationsTableProps {
  automations: AutomationWithRelations[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function AutomationsTable({
  automations,
  pagination,
  canCreate,
  canUpdate,
  canDelete,
}: AutomationsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(
    searchParams.get("search") || ""
  );
  const [selectedAutomation, setSelectedAutomation] =
    useState<AutomationWithRelations | null>(null);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Active filters
  const currentEntity = searchParams.get("entityType") || "all";
  const currentTrigger = searchParams.get("triggerType") || "all";
  const currentStatus = searchParams.get("status") || "active";
  const currentSearch = searchParams.get("search") || "";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    if (!updates.page && updates.page !== null) {
      params.set("page", "1");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParams({ search: searchInput });
  }

  function handleClearSearch() {
    setSearchInput("");
    updateParams({ search: null });
  }

  function handleResetFilters() {
    setSearchInput("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  async function handleToggleActive(auto: AutomationWithRelations) {
    if (!canUpdate || togglingId || auto.archivedAt) return;
    setTogglingId(auto.id);
    try {
      await toggleAutomationActiveAction(auto.id, !auto.active);
      router.refresh();
    } finally {
      setTogglingId(null);
    }
  }

  function renderEntityBadge(entity: AutomationEntityType) {
    switch (entity) {
      case "deal":
        return (
          <Badge
            variant="outline"
            className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1 font-medium"
          >
            <Briefcase className="h-3 w-3" />
            Deal
          </Badge>
        );
      case "lead":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-medium"
          >
            <UserPlus className="h-3 w-3" />
            Lead
          </Badge>
        );
      case "contact":
        return (
          <Badge
            variant="outline"
            className="bg-teal-50 text-teal-700 border-teal-200 gap-1 font-medium"
          >
            <Contact className="h-3 w-3" />
            Contact
          </Badge>
        );
      case "company":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 gap-1 font-medium"
          >
            <Building className="h-3 w-3" />
            Company
          </Badge>
        );
    }
  }

  const hasActiveFilters =
    Boolean(currentSearch) ||
    currentEntity !== "all" ||
    currentTrigger !== "all" ||
    currentStatus !== "active";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Automations
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Define automatic workflows, activities, follow-ups, and stage
                transitions
              </p>
            </div>
          </div>
        </div>

        {canCreate && (
          <Link href="/automations/new">
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shrink-0">
              <Plus className="h-4 w-4" />
              New Automation
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search automations by name or description..."
            className="pl-9 pr-8 text-xs sm:text-sm h-9 bg-slate-50/50 border-slate-200 focus-visible:bg-white"
          />
          {searchInput && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* Filters */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          {/* Status Filter */}
          <Select
            value={currentStatus}
            onValueChange={(val) => updateParams({ status: val })}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm w-[130px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All Automations</SelectItem>
            </SelectContent>
          </Select>

          {/* Entity Filter */}
          <Select
            value={currentEntity}
            onValueChange={(val) => updateParams({ entityType: val })}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm w-[130px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem value="deal">Deals</SelectItem>
              <SelectItem value="lead">Leads</SelectItem>
              <SelectItem value="contact">Contacts</SelectItem>
              <SelectItem value="company">Companies</SelectItem>
            </SelectContent>
          </Select>

          {/* Trigger Filter */}
          <Select
            value={currentTrigger}
            onValueChange={(val) => updateParams({ triggerType: val })}
          >
            <SelectTrigger className="h-9 text-xs sm:text-sm w-[170px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Triggers</SelectItem>
              {Object.values(TRIGGER_REGISTRY).map((trig) => (
                <SelectItem key={trig.key} value={trig.key}>
                  {trig.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-9 text-xs text-slate-500 hover:text-slate-800 gap-1.5 px-2.5"
            >
              <FilterX className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/75">
            <TableRow>
              <TableHead className="font-semibold text-xs text-slate-700">
                Automation
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700">
                Entity
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700">
                Trigger
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700">
                Status
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700">
                Executions
              </TableHead>
              <TableHead className="font-semibold text-xs text-slate-700">
                Created
              </TableHead>
              <TableHead className="w-12 text-right font-semibold text-xs text-slate-700">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {automations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-48 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="p-3 rounded-full bg-slate-100 text-slate-400">
                      <Zap className="h-6 w-6" />
                    </div>
                    <p className="font-semibold text-slate-700 text-sm">
                      No automations found
                    </p>
                    <p className="text-xs text-slate-400">
                      {hasActiveFilters
                        ? "Try clearing filters or search to see more automations."
                        : "Create automated rules to effortlessly manage tasks, activities, and follow-ups."}
                    </p>
                    {canCreate && !hasActiveFilters && (
                      <Link href="/automations/new">
                        <Button size="sm" className="mt-2 gap-1.5 bg-blue-600">
                          <Plus className="h-3.5 w-3.5" />
                          Create Automation
                        </Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              automations.map((auto) => {
                const triggerDef = TRIGGER_REGISTRY[auto.triggerType as AutomationTriggerType];
                const totalExecutions = auto.executionStats?.total || 0;
                const lastStatus = auto.executionStats?.lastStatus;

                return (
                  <TableRow
                    key={auto.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Name & Description */}
                    <TableCell className="max-w-[260px]">
                      <div className="space-y-0.5">
                        <Link
                          href={`/automations/${auto.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 text-xs sm:text-sm line-clamp-1 transition-colors"
                        >
                          {auto.name}
                        </Link>
                        {auto.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {auto.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-600">
                            {auto.conditions.length === 0
                              ? "Always runs"
                              : `${auto.conditions.reduce((acc, g) => acc + g.conditions.length, 0)} condition(s)`}
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-600">
                            {auto.actions.length} action(s)
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Entity */}
                    <TableCell>
                      {renderEntityBadge(auto.entityType)}
                    </TableCell>

                    {/* Trigger */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-slate-100 text-slate-700 border-slate-200 font-normal text-xs"
                      >
                        {triggerDef?.label || auto.triggerType}
                      </Badge>
                    </TableCell>

                    {/* Active toggle / status */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canUpdate && !auto.archivedAt ? (
                          <Switch
                            checked={auto.active}
                            onCheckedChange={() => handleToggleActive(auto)}
                            disabled={togglingId === auto.id}
                            title={auto.active ? "Click to deactivate" : "Click to activate"}
                          />
                        ) : null}
                        <AutomationStatusBadge
                          active={auto.active}
                          archivedAt={auto.archivedAt}
                        />
                      </div>
                    </TableCell>

                    {/* Executions Stats */}
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-700">
                            {totalExecutions} run{totalExecutions === 1 ? "" : "s"}
                          </span>
                          {lastStatus && (
                            <ExecutionStatusBadge status={lastStatus} />
                          )}
                        </div>
                        {auto.executionStats?.lastExecutedAt && (
                          <p className="text-[10px] text-slate-400">
                            Last: {new Date(auto.executionStats.lastExecutedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(auto.createdAt).toLocaleDateString()}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/automations/${auto.id}`}
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <Eye className="h-3.5 w-3.5 text-slate-500" />
                              View Details
                            </Link>
                          </DropdownMenuItem>

                          {canUpdate && !auto.archivedAt && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/automations/${auto.id}/edit`}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                                Edit Rule
                              </Link>
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuSeparator />

                          {auto.archivedAt ? (
                            canUpdate && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAutomation(auto);
                                  setDialogMode("restore");
                                  setDialogOpen(true);
                                }}
                                className="gap-2 cursor-pointer text-xs text-blue-600 focus:text-blue-700"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore
                              </DropdownMenuItem>
                            )
                          ) : (
                            canDelete && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAutomation(auto);
                                  setDialogMode("archive");
                                  setDialogOpen(true);
                                }}
                                className="gap-2 cursor-pointer text-xs text-rose-600 focus:text-rose-700"
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-500">
            <div>
              Showing{" "}
              <strong className="text-slate-700">
                {(pagination.page - 1) * pagination.pageSize + 1}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-700">
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.total
                )}
              </strong>{" "}
              of <strong className="text-slate-700">{pagination.total}</strong>{" "}
              automations
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1 text-xs"
                disabled={pagination.page <= 1}
                onClick={() =>
                  updateParams({ page: String(pagination.page - 1) })
                }
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <span className="px-2 text-xs font-medium text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 gap-1 text-xs"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  updateParams({ page: String(pagination.page + 1) })
                }
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ArchiveAutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
        mode={dialogMode}
      />
    </div>
  );
}
