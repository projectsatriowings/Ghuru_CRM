"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  type LeadWithRelations,
  type LeadPagination,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from "@/lib/types/leads";
import { type PipelineWithStages } from "@/lib/types/pipelines";
import { LeadStatusBadge } from "./lead-status-badge";
import { ArchiveLeadDialog } from "./archive-lead-dialog";
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
import {
  Search,
  X,
  Plus,
  MoreHorizontal,
  Eye,
  Edit2,
  Archive,
  RotateCcw,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  FilterX,
  UserCheck,
} from "lucide-react";

interface LeadsTableProps {
  leads: LeadWithRelations[];
  pipelines?: PipelineWithStages[];
  pagination: LeadPagination;
  members: Array<{ id: string; name: string; email: string }>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

function formatRelativeTime(dateInput: Date | string | number): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LeadsTable({
  leads,
  pipelines = [],
  pagination,
  members,
  canCreate,
  canUpdate,
  canDelete,
}: LeadsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local filter states populated from URL
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "all";
  const currentSource = searchParams.get("source") || "all";
  const currentAssignedTo = searchParams.get("assignedTo") || "all";
  const currentPipelineId = searchParams.get("pipelineId") || "all";
  const currentStageId = searchParams.get("stageId") || "all";
  const currentArchived = searchParams.get("archived") || "false";
  const currentPage = Number(searchParams.get("page") || "1");
  const currentPageSize = Number(searchParams.get("pageSize") || "25");

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Selected pipeline for stage filter
  const selectedFilterPipeline = pipelines.find((p) => p.id === currentPipelineId);
  const availableFilterStages = selectedFilterPipeline?.stages
    ? [...selectedFilterPipeline.stages].sort((a, b) => a.displayOrder - b.displayOrder)
    : [];

  // Dialog State
  const [dialogLead, setDialogLead] = useState<LeadWithRelations | null>(null);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const updateFilters = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
    // Reset to page 1 whenever filters change, unless page itself is being changed
    if (!("page" in updates)) {
      params.set("page", "1");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchTerm.trim() });
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    updateFilters({ search: null });
  };

  const hasActiveFilters =
    currentSearch !== "" ||
    currentStatus !== "all" ||
    currentSource !== "all" ||
    currentAssignedTo !== "all" ||
    currentPipelineId !== "all" ||
    currentStageId !== "all" ||
    currentArchived !== "false";

  const clearAllFilters = () => {
    setSearchTerm("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Leads
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and track incoming prospects across your organization.
          </p>
        </div>

        {canCreate && (
          <Link href="/leads/new">
            <Button className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm gap-2">
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
          {/* Search Input */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 min-w-[220px]"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Search leads by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs bg-slate-50/50 border-slate-200 focus:bg-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* Dropdown Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* Status Filter */}
            <Select
              value={currentStatus}
              onValueChange={(val) => updateFilters({ status: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Statuses
                </SelectItem>
                {LEAD_STATUSES.map((st) => (
                  <SelectItem key={st} value={st} className="text-xs">
                    {LEAD_STATUS_LABELS[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Pipeline Filter */}
            <Select
              value={currentPipelineId}
              onValueChange={(val) => {
                updateFilters({ pipelineId: val, stageId: null });
              }}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Pipelines
                </SelectItem>
                <SelectItem value="unassigned" className="text-xs text-slate-500">
                  Unassigned
                </SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stage Filter */}
            <Select
              value={currentStageId}
              onValueChange={(val) => updateFilters({ stageId: val })}
              disabled={
                currentPipelineId === "all" ||
                currentPipelineId === "unassigned" ||
                availableFilterStages.length === 0
              }
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue
                  placeholder={
                    currentPipelineId === "all"
                      ? "Filter by pipeline first"
                      : currentPipelineId === "unassigned"
                      ? "No stages"
                      : availableFilterStages.length === 0
                      ? "No stages"
                      : "Stage"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Stages
                </SelectItem>
                <SelectItem value="unassigned" className="text-xs text-slate-500">
                  Unassigned
                </SelectItem>
                {availableFilterStages.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs">
                    {st.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Source Filter */}
            <Select
              value={currentSource}
              onValueChange={(val) => updateFilters({ source: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Sources
                </SelectItem>
                {LEAD_SOURCES.map((src) => (
                  <SelectItem key={src} value={src} className="text-xs">
                    {LEAD_SOURCE_LABELS[src]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assigned To Filter */}
            <Select
              value={currentAssignedTo}
              onValueChange={(val) => updateFilters({ assignedTo: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Assigned to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Assignees
                </SelectItem>
                <SelectItem value="unassigned" className="text-xs text-slate-500">
                  Unassigned
                </SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Archived Filter */}
            <Select
              value={currentArchived}
              onValueChange={(val) => updateFilters({ archived: val })}
            >
              <SelectTrigger className="h-9 text-xs bg-slate-50/50 border-slate-200">
                <SelectValue placeholder="Active state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false" className="text-xs">
                  Active Leads
                </SelectItem>
                <SelectItem value="true" className="text-xs">
                  Archived Leads
                </SelectItem>
                <SelectItem value="all" className="text-xs">
                  All Leads
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Clear Indicator */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Filtering leads ({pagination.total} matching)
            </span>
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 font-medium transition-colors"
            >
              <FilterX className="h-3 w-3" />
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Main Table / Cards */}
      <div
        className={`bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-opacity ${
          isPending ? "opacity-60" : "opacity-100"
        }`}
      >
        {leads.length === 0 ? (
          /* Empty State */
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {hasActiveFilters ? "No matching leads found" : "No leads yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {hasActiveFilters
                ? "Try adjusting your search terms or filter criteria to find what you're looking for."
                : "Start building your pipeline by adding your first lead."}
            </p>
            {hasActiveFilters ? (
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="h-8 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 mt-1"
              >
                Clear filters
              </Button>
            ) : (
              canCreate && (
                <Link href="/leads/new">
                  <Button className="h-8 px-3.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg mt-1 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Add Lead
                  </Button>
                </Link>
              )
            )}
          </div>
        ) : (
          <>
            {/* Desktop CRM Table */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[26%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider pl-5">
                      Lead
                    </TableHead>
                    <TableHead className="w-[12%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="w-[15%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Pipeline
                    </TableHead>
                    <TableHead className="w-[15%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Stage
                    </TableHead>
                    <TableHead className="w-[14%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Assigned To
                    </TableHead>
                    <TableHead className="w-[10%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Updated
                    </TableHead>
                    <TableHead className="w-[8%] py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider text-right pr-5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {leads.map((lead) => {
                    const fullName = `${lead.firstName} ${lead.lastName || ""}`.trim();
                    const isArchived = Boolean(lead.archivedAt);

                    return (
                      <TableRow
                        key={lead.id}
                        className={`hover:bg-slate-50/60 transition-colors ${
                          isArchived ? "bg-amber-50/20" : ""
                        }`}
                      >
                        {/* Lead Contact Info */}
                        <TableCell className="py-3.5 pl-5">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="group block"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {fullName}
                              </span>
                              {isArchived && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                              {lead.email && (
                                <span className="inline-flex items-center gap-1 text-slate-500 truncate max-w-[160px]">
                                  <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                                  {lead.email}
                                </span>
                              )}
                              {lead.phone && (
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                  <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                                  {lead.phone}
                                </span>
                              )}
                            </div>
                          </Link>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="py-3.5">
                          <LeadStatusBadge status={lead.status} />
                        </TableCell>

                        {/* Pipeline */}
                        <TableCell className="py-3.5">
                          {lead.pipeline ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                              {lead.pipeline.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Not assigned
                            </span>
                          )}
                        </TableCell>

                        {/* Stage */}
                        <TableCell className="py-3.5">
                          {lead.stage ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {lead.stage.name}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Not assigned
                            </span>
                          )}
                        </TableCell>

                        {/* Assigned To */}
                        <TableCell className="py-3.5">
                          {lead.assignedToUser ? (
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold border border-slate-200">
                                {lead.assignedToUser.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-xs font-medium text-slate-700 truncate max-w-[130px]">
                                {lead.assignedToUser.name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              Unassigned
                            </span>
                          )}
                        </TableCell>

                        {/* Updated Relative */}
                        <TableCell className="py-3.5 text-xs text-slate-500 font-mono">
                          {formatRelativeTime(lead.updatedAt)}
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="py-3.5 text-right pr-5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 text-xs">
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/leads/${lead.id}`}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                                  <span>View detail</span>
                                </Link>
                              </DropdownMenuItem>
                              {canUpdate && (
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/leads/${lead.id}/edit`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Edit lead</span>
                                  </Link>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {isArchived ? (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDialogLead(lead);
                                    setDialogMode("restore");
                                    setIsDialogOpen(true);
                                  }}
                                  className="flex items-center gap-2 text-blue-600 focus:text-blue-600 cursor-pointer"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  <span>Restore lead</span>
                                </DropdownMenuItem>
                              ) : (
                                canDelete && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setDialogLead(lead);
                                      setDialogMode("archive");
                                      setIsDialogOpen(true);
                                    }}
                                    className="flex items-center gap-2 text-amber-600 focus:text-amber-600 cursor-pointer"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                    <span>Archive lead</span>
                                  </DropdownMenuItem>
                                )
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {leads.map((lead) => {
                const fullName = `${lead.firstName} ${lead.lastName || ""}`.trim();
                const isArchived = Boolean(lead.archivedAt);

                return (
                  <div key={lead.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {fullName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <LeadStatusBadge status={lead.status} />
                          {lead.pipeline ? (
                            <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-medium border border-slate-200/60">
                              {lead.pipeline.name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              No pipeline
                            </span>
                          )}
                          {lead.stage && (
                            <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold border border-indigo-100">
                              {lead.stage.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-400"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                          <DropdownMenuItem asChild>
                            <Link href={`/leads/${lead.id}`}>View detail</Link>
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem asChild>
                              <Link href={`/leads/${lead.id}/edit`}>Edit</Link>
                            </DropdownMenuItem>
                          )}
                          {isArchived ? (
                            <DropdownMenuItem
                              onClick={() => {
                                setDialogLead(lead);
                                setDialogMode("restore");
                                setIsDialogOpen(true);
                              }}
                            >
                              Restore
                            </DropdownMenuItem>
                          ) : (
                            canDelete && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setDialogLead(lead);
                                  setDialogMode("archive");
                                  setIsDialogOpen(true);
                                }}
                                className="text-amber-600"
                              >
                                Archive
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="text-xs text-slate-500 space-y-1">
                      {lead.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 text-slate-400" />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-100">
                        <span>
                          Assigned: {lead.assignedToUser?.name || "Unassigned"}
                        </span>
                        <span>{formatRelativeTime(lead.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span>
                  Showing{" "}
                  <strong className="text-slate-700">
                    {pagination.total > 0
                      ? (pagination.page - 1) * pagination.pageSize + 1
                      : 0}
                  </strong>{" "}
                  to{" "}
                  <strong className="text-slate-700">
                    {Math.min(
                      pagination.page * pagination.pageSize,
                      pagination.total
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-700">{pagination.total}</strong>{" "}
                  leads
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Rows:</span>
                  <Select
                    value={String(currentPageSize)}
                    onValueChange={(val) =>
                      updateFilters({ pageSize: Number(val), page: 1 })
                    }
                  >
                    <SelectTrigger className="h-7 w-16 text-xs bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25" className="text-xs">
                        25
                      </SelectItem>
                      <SelectItem value="50" className="text-xs">
                        50
                      </SelectItem>
                      <SelectItem value="100" className="text-xs">
                        100
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: currentPage - 1 })}
                  disabled={currentPage <= 1 || isPending}
                  className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-medium text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ page: currentPage + 1 })}
                  disabled={currentPage >= pagination.totalPages || isPending}
                  className="h-8 w-8 p-0 border-slate-200 hover:bg-slate-100 rounded-lg disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Archive / Restore Confirmation Dialog */}
      <ArchiveLeadDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        lead={dialogLead}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
