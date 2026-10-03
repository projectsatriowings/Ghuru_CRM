"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  type ContactWithRelations,
  type ContactPagination,
} from "@/lib/types/contacts";
import { ArchiveContactDialog } from "./archive-contact-dialog";
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
  User,
} from "lucide-react";

interface ContactsTableProps {
  contacts: ContactWithRelations[];
  pagination: ContactPagination;
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

export function ContactsTable({
  contacts,
  pagination,
  members,
  canCreate,
  canUpdate,
  canDelete,
}: ContactsTableProps) {
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
  const [dialogContact, setDialogContact] =
    useState<ContactWithRelations | null>(null);
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
            Contacts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and organize your contact relationships across your organization
          </p>
        </div>

        {canCreate && (
          <Link href="/contacts/new">
            <Button className="h-9 px-4 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Contact
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
              placeholder="Search by name, email, phone..."
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
                  Active Contacts
                </SelectItem>
                <SelectItem value="true" className="text-xs text-amber-700">
                  Archived Contacts
                </SelectItem>
                <SelectItem value="all" className="text-xs">
                  All Contacts
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

      {/* Contacts Table / Desktop View */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isPending ? (
          <div className="py-20 text-center text-xs text-slate-400">
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center mx-auto text-slate-400">
              <User className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                No contacts found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-0.5">
                {hasActiveFilters
                  ? "No contacts match the selected search or filter criteria. Try adjusting or clearing your filters."
                  : "Start creating contacts to organize people and relationships for your organization."}
              </p>
            </div>
            {canCreate && !hasActiveFilters && (
              <Link href="/contacts/new">
                <Button className="mt-2 h-8 px-3.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Contact
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
                    Contact
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Email
                  </TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 uppercase tracking-wider py-3">
                    Phone
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
                {contacts.map((contact) => {
                  const fullName = `${contact.firstName} ${
                    contact.lastName || ""
                  }`.trim();
                  const isArchived = Boolean(contact.archivedAt);

                  return (
                    <TableRow
                      key={contact.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Contact */}
                      <TableCell className="pl-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                            {contact.firstName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/contacts/${contact.id}`}
                                className="font-semibold text-xs text-slate-900 hover:text-blue-600 transition-colors"
                              >
                                {fullName}
                              </Link>
                              {isArchived && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                  Archived
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {contact.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Email */}
                      <TableCell className="py-3.5">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">
                              {contact.email}
                            </span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 italic">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Phone */}
                      <TableCell className="py-3.5">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{contact.phone}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300 italic">
                            —
                          </span>
                        )}
                      </TableCell>

                      {/* Owner */}
                      <TableCell className="py-3.5">
                        {contact.ownerUser ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {contact.ownerUser.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs text-slate-700 font-medium truncate max-w-[120px]">
                              {contact.ownerUser.name}
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
                        {formatRelativeTime(contact.updatedAt)}
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
                                href={`/contacts/${contact.id}`}
                                className="flex items-center gap-2 text-xs cursor-pointer"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" />
                                View Details
                              </Link>
                            </DropdownMenuItem>

                            {canUpdate && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/contacts/${contact.id}/edit`}
                                  className="flex items-center gap-2 text-xs cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                                  Edit Contact
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
                                        setDialogContact(contact);
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
                                        setDialogContact(contact);
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
                contacts
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
      <ArchiveContactDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        contact={dialogContact}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
