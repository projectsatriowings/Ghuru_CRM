"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  type CompanyWithRelations,
  type CompanyPagination,
} from "@/lib/types/companies";
import { ArchiveCompanyDialog } from "./archive-company-dialog";
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
  Globe,
  ChevronLeft,
  ChevronRight,
  FilterX,
  UserCheck,
  Building,
} from "lucide-react";

interface CompaniesTableProps {
  companies: CompanyWithRelations[];
  pagination: CompanyPagination;
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

export function CompaniesTable({
  companies,
  pagination,
  members,
  canCreate,
  canUpdate,
  canDelete,
}: CompaniesTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local filter states populated from URL
  const currentSearch = searchParams.get("search") || "";
  const currentOwnerId = searchParams.get("ownerId") || "all";
  const currentArchived = searchParams.get("archived") || "false";
  const currentPageSize = Number(searchParams.get("pageSize") || "25");

  const [searchTerm, setSearchTerm] = useState(currentSearch);

  // Dialog State
  const [dialogCompany, setDialogCompany] =
    useState<CompanyWithRelations | null>(null);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">(
    "archive"
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // URL update handler
  const updateQuery = (paramsToUpdate: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(paramsToUpdate).forEach(([key, val]) => {
      if (val === null || val === "" || val === "all") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    // Reset page to 1 when filters change (unless updating page itself)
    if (!("page" in paramsToUpdate)) {
      params.delete("page");
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: searchTerm.trim() || null });
  };

  const clearFilters = () => {
    setSearchTerm("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasActiveFilters =
    Boolean(currentSearch) ||
    currentOwnerId !== "all" ||
    currentArchived !== "false";

  return (
    <div className="space-y-4">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Companies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organizations and business accounts across your CRM.
          </p>
        </div>

        {canCreate && (
          <Link href="/companies/new">
            <Button className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Company
            </Button>
          </Link>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search box */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex-1 min-w-[200px]"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by company name, email, phone, website, industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs border-slate-200 focus-visible:ring-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  updateQuery({ search: null });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>

          {/* Owner Filter */}
          <div className="w-full md:w-48">
            <Select
              value={currentOwnerId}
              onValueChange={(val) => updateQuery({ ownerId: val })}
            >
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                <div className="flex items-center gap-1.5 truncate">
                  <UserCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <SelectValue placeholder="All Owners" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  All Owners
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
          </div>

          {/* Archived Filter */}
          <div className="w-full md:w-44">
            <Select
              value={currentArchived}
              onValueChange={(val) => updateQuery({ archived: val })}
            >
              <SelectTrigger className="h-9 text-xs border-slate-200 bg-white">
                <SelectValue placeholder="Status: Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false" className="text-xs">
                  Active Companies
                </SelectItem>
                <SelectItem value="true" className="text-xs text-amber-700">
                  Archived Companies
                </SelectItem>
                <SelectItem value="all" className="text-xs">
                  All Companies
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="h-9 px-3 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg gap-1.5 shrink-0"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Companies Table / Desktop View */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isPending ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Loading companies...
          </div>
        ) : companies.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center mx-auto text-slate-400">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                No companies found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                {hasActiveFilters
                  ? "No companies match the selected search or filter criteria. Try adjusting or clearing your filters."
                  : "Start creating companies to track organizations and accounts for your CRM."}
              </p>
            </div>
            {canCreate && !hasActiveFilters && (
              <Link href="/companies/new">
                <Button className="mt-2 h-8 px-3.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Company
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60 border-b border-slate-200/70 hover:bg-slate-50/60">
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider pl-5 py-3">
                    Company
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Industry
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Company Size
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Owner
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Updated
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider text-right pr-5 py-3">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => {
                  const isArchived = Boolean(company.archivedAt);

                  return (
                    <TableRow
                      key={company.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Company */}
                      <TableCell className="pl-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                            <Building className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/companies/${company.id}`}
                                className="font-semibold text-xs text-slate-900 hover:text-blue-600 transition-colors"
                              >
                                {company.name}
                              </Link>
                              {isArchived && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {company.website && (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  <Globe className="h-2.5 w-2.5" />
                                  {company.website.replace(/^https?:\/\//, "")}
                                </a>
                              )}
                              {company.email && (
                                <span className="text-[10px] text-slate-400">
                                  {company.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>

                      {/* Industry */}
                      <TableCell className="py-3.5">
                        {company.industry ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                            {company.industry}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Company Size */}
                      <TableCell className="py-3.5">
                        {company.companySize ? (
                          <span className="text-xs text-slate-700">
                            {company.companySize}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 italic">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Owner */}
                      <TableCell className="py-3.5">
                        {company.ownerUser ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {company.ownerUser.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[120px]">
                              {company.ownerUser.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      {/* Updated */}
                      <TableCell className="py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(company.updatedAt)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-5 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-slate-600 rounded-md"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/companies/${company.id}`}
                                className="flex items-center gap-2 text-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                View Details
                              </Link>
                            </DropdownMenuItem>

                            {canUpdate && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/companies/${company.id}/edit`}
                                  className="flex items-center gap-2 text-xs cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                                  Edit Company
                                </Link>
                              </DropdownMenuItem>
                            )}

                            {(canDelete || canUpdate) && (
                              <>
                                <DropdownMenuSeparator />
                                {isArchived ? (
                                  canUpdate && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDialogCompany(company);
                                        setDialogMode("restore");
                                        setIsDialogOpen(true);
                                      }}
                                      className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Restore
                                    </DropdownMenuItem>
                                  )
                                ) : (
                                  canDelete && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setDialogCompany(company);
                                        setDialogMode("archive");
                                        setIsDialogOpen(true);
                                      }}
                                      className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer"
                                    >
                                      <Archive className="h-3.5 w-3.5" />
                                      Archive
                                    </DropdownMenuItem>
                                  )
                                )}
                              </>
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
        )}

        {/* Pagination Bar */}
        {pagination.total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/40">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                Showing{" "}
                <span className="font-semibold text-slate-700">
                  {Math.min(
                    (pagination.page - 1) * pagination.pageSize + 1,
                    pagination.total
                  )}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-700">
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total
                  )}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-700">
                  {pagination.total}
                </span>{" "}
                companies
              </span>

              <div className="h-3 w-px bg-slate-200 mx-1" />

              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <Select
                  value={String(currentPageSize)}
                  onValueChange={(val) =>
                    updateQuery({ pageSize: val, page: "1" })
                  }
                >
                  <SelectTrigger className="h-7 w-16 text-xs border-slate-200 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10" className="text-xs">
                      10
                    </SelectItem>
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuery({ page: String(pagination.page - 1) })
                }
                disabled={pagination.page <= 1}
                className="h-8 px-2.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 rounded-lg gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="text-xs text-slate-500 px-1">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuery({ page: String(pagination.page + 1) })
                }
                disabled={pagination.page >= pagination.totalPages}
                className="h-8 px-2.5 text-xs text-slate-600 border-slate-200 hover:bg-slate-50 rounded-lg gap-1"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Archive / Restore Dialog */}
      <ArchiveCompanyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        company={dialogCompany}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
