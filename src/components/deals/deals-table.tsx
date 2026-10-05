"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  type DealWithRelations,
  type DealPagination,
} from "@/lib/types/deals";
import { DealStatusBadge } from "./deal-status-badge";
import { ArchiveDealDialog } from "./archive-deal-dialog";
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
  Briefcase,
  Building,
  Contact,
  Calendar,
} from "lucide-react";

interface PipelineFilterItem {
  id: string;
  name: string;
}

interface DealsTableProps {
  deals: DealWithRelations[];
  pagination: DealPagination;
  members: Array<{ id: string; name: string; email: string }>;
  pipelines: PipelineFilterItem[];
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

function formatCurrency(amount: number | null | undefined, currency: string = "USD") {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export function DealsTable({
  deals,
  pagination,
  members,
  pipelines,
  canCreate,
  canUpdate,
  canDelete,
}: DealsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local filter states from URL
  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "all";
  const currentPipelineId = searchParams.get("pipelineId") || "all";
  const currentOwnerId = searchParams.get("ownerId") || "all";
  const currentArchived = searchParams.get("archived") || "false";
  const currentPageSize = Number(searchParams.get("pageSize") || "25");

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Dialog State
  const [targetDeal, setTargetDeal] = useState<DealWithRelations | null>(null);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");
  const [dialogOpen, setDialogOpen] = useState(false);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    if (!("page" in updates)) {
      params.set("page", "1");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({ search: searchTerm.trim() || null });
  }

  function handleClearSearch() {
    setSearchTerm("");
    updateQuery({ search: null });
  }

  const hasActiveFilters =
    Boolean(currentSearch) ||
    currentStatus !== "all" ||
    currentPipelineId !== "all" ||
    currentOwnerId !== "all" ||
    currentArchived !== "false";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Briefcase className="h-5 w-5 text-blue-600" />
            Deals
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track and manage commercial opportunities across your pipelines.
          </p>
        </div>

        {canCreate && (
          <Link href="/deals/new">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" />
              <span>Create Deal</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search deals by name, company, or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 pr-8 text-xs h-9 bg-slate-50/50 border-slate-200 focus:bg-white"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <Select
            value={currentStatus}
            onValueChange={(val) => updateQuery({ status: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[115px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Statuses</SelectItem>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="won" className="text-xs">Won</SelectItem>
              <SelectItem value="lost" className="text-xs">Lost</SelectItem>
            </SelectContent>
          </Select>

          {/* Pipeline Filter */}
          <Select
            value={currentPipelineId}
            onValueChange={(val) => updateQuery({ pipelineId: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[135px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Pipeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Pipelines</SelectItem>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Owner Filter */}
          <Select
            value={currentOwnerId}
            onValueChange={(val) => updateQuery({ ownerId: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[130px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Owners</SelectItem>
              <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Archived Toggle */}
          <Select
            value={currentArchived}
            onValueChange={(val) => updateQuery({ archived: val })}
          >
            <SelectTrigger className="text-xs h-9 w-[105px] bg-slate-50/50 border-slate-200">
              <SelectValue placeholder="Archive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false" className="text-xs">Active</SelectItem>
              <SelectItem value="true" className="text-xs">Archived</SelectItem>
              <SelectItem value="all" className="text-xs">All Deals</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                updateQuery({
                  search: null,
                  status: null,
                  pipelineId: null,
                  ownerId: null,
                  archived: "false",
                });
              }}
              className="text-xs text-slate-500 hover:text-slate-800 h-9 px-2 gap-1"
            >
              <FilterX className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {deals.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">No deals found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
              {hasActiveFilters
                ? "Try adjusting your search criteria or resetting filters to find deals."
                : "Create your first commercial opportunity to start tracking pipeline progress."}
            </p>
            {canCreate && !hasActiveFilters && (
              <Link href="/deals/new">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  <Plus className="h-4 w-4" />
                  Create Deal
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/75 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-700 py-3">Deal</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Company</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Contact</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Pipeline / Stage</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 text-right">Value</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Expected Close</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700">Owner</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-700 text-right pr-6">Updated</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow
                    key={deal.id}
                    className="hover:bg-slate-50/70 border-b border-slate-100 transition-colors"
                  >
                    {/* Deal Name & Description */}
                    <TableCell className="py-3 font-medium">
                      <Link
                        href={`/deals/${deal.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline block"
                      >
                        {deal.name}
                      </Link>
                      {deal.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {deal.description}
                        </p>
                      )}
                    </TableCell>

                    {/* Company */}
                    <TableCell className="text-xs text-slate-600">
                      {deal.company ? (
                        <Link
                          href={`/companies/${deal.company.id}`}
                          className="hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <Building className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[130px]">{deal.company.name}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Contact */}
                    <TableCell className="text-xs text-slate-600">
                      {deal.contact ? (
                        <Link
                          href={`/contacts/${deal.contact.id}`}
                          className="hover:text-blue-600 flex items-center gap-1.5"
                        >
                          <Contact className="h-3 w-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">
                            {deal.contact.firstName} {deal.contact.lastName || ""}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Pipeline & Stage */}
                    <TableCell className="text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-slate-400 block truncate max-w-[120px]">
                          {deal.pipeline.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-medium"
                        >
                          {deal.stage.name}
                        </Badge>
                      </div>
                    </TableCell>

                    {/* Value */}
                    <TableCell className="text-xs text-right font-semibold text-slate-900">
                      {deal.value !== null ? (
                        <div>
                          <span>{formatCurrency(Number(deal.value), deal.currency)}</span>
                          {deal.probability !== null && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {deal.probability}% prob.
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </TableCell>

                    {/* Expected Close Date */}
                    <TableCell className="text-xs text-slate-600">
                      {deal.expectedCloseDate ? (
                        <span className="flex items-center gap-1 text-[11px]">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(deal.expectedCloseDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <DealStatusBadge status={deal.status} />
                    </TableCell>

                    {/* Owner */}
                    <TableCell className="text-xs text-slate-600">
                      {deal.ownerUser ? (
                        <span className="truncate max-w-[100px] block" title={deal.ownerUser.name}>
                          {deal.ownerUser.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Updated */}
                    <TableCell className="text-[11px] text-slate-400 text-right pr-6 whitespace-nowrap">
                      {formatRelativeTime(deal.updatedAt)}
                    </TableCell>

                    {/* Actions Menu */}
                    <TableCell className="pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 text-xs">
                          <DropdownMenuItem asChild>
                            <Link href={`/deals/${deal.id}`} className="cursor-pointer gap-2">
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem asChild>
                              <Link href={`/deals/${deal.id}/edit`} className="cursor-pointer gap-2">
                                <Edit2 className="h-3.5 w-3.5" />
                                Edit Deal
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {deal.archivedAt ? (
                            canUpdate && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setTargetDeal(deal);
                                  setDialogMode("restore");
                                  setDialogOpen(true);
                                }}
                                className="cursor-pointer gap-2 text-blue-600 focus:text-blue-700"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Restore Deal
                              </DropdownMenuItem>
                            )
                          ) : (
                            canDelete && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setTargetDeal(deal);
                                  setDialogMode("archive");
                                  setDialogOpen(true);
                                }}
                                className="cursor-pointer gap-2 text-rose-600 focus:text-rose-700"
                              >
                                <Archive className="h-3.5 w-3.5" />
                                Archive Deal
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Bar */}
        {deals.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {(pagination.page - 1) * pagination.pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900">
                {Math.min(pagination.page * pagination.pageSize, pagination.total)}
              </span>{" "}
              of <span className="font-semibold text-slate-900">{pagination.total}</span> deals
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500">Rows:</span>
                <Select
                  value={String(currentPageSize)}
                  onValueChange={(val) => updateQuery({ pageSize: val, page: "1" })}
                >
                  <SelectTrigger className="h-7 w-16 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10" className="text-xs">10</SelectItem>
                    <SelectItem value="25" className="text-xs">25</SelectItem>
                    <SelectItem value="50" className="text-xs">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isPending}
                  onClick={() => updateQuery({ page: String(pagination.page - 1) })}
                  className="h-7 px-2 bg-white"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] px-1 font-medium">
                  {pagination.page} / {pagination.totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isPending}
                  onClick={() => updateQuery({ page: String(pagination.page + 1) })}
                  className="h-7 px-2 bg-white"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Archive / Restore Confirmation Dialog */}
      <ArchiveDealDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        deal={targetDeal}
        mode={dialogMode}
        onSuccess={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
