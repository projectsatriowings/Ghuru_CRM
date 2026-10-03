"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ContactWithRelations } from "@/lib/types/contacts";
import { updateContactAction } from "@/lib/actions/contact.actions";
import {
  EntityCombobox,
  type ComboboxOption,
} from "@/components/common/entity-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Building,
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Star,
} from "lucide-react";

interface ContactCompanyCardProps {
  contact: ContactWithRelations;
  canUpdate: boolean;
}

export function ContactCompanyCard({
  contact,
  canUpdate,
}: ContactCompanyCardProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    contact.companyId || null
  );
  const [isPrimary, setIsPrimary] = useState<boolean>(
    contact.isPrimaryContact || false
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/companies?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data.map(
          (c: { id: string; name: string; industry?: string }) => ({
            id: c.id,
            name: c.name,
            subtext: c.industry || undefined,
          })
        );
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleOpenDialog = () => {
    setSelectedCompanyId(contact.companyId || null);
    setIsPrimary(contact.isPrimaryContact || false);
    setError(null);
    setIsDialogOpen(true);
  };

  const handleSaveCompany = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await updateContactAction(contact.id, {
        companyId: selectedCompanyId || null,
        isPrimaryContact: Boolean(selectedCompanyId && isPrimary),
      });

      if (!res.success) {
        setError(res.error || "Failed to update company association.");
        setLoading(false);
        return;
      }

      setIsDialogOpen(false);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to update company."
      );
      setLoading(false);
    }
  };

  const handleRemoveCompany = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await updateContactAction(contact.id, {
        companyId: null,
        isPrimaryContact: false,
      });

      if (!res.success) {
        setError(res.error || "Failed to remove company association.");
        setLoading(false);
        return;
      }

      setIsRemoveOpen(false);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to remove company."
      );
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Company
            </h3>
          </div>
          {canUpdate && contact.company && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenDialog}
                className="h-7 px-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <Edit2 className="h-3 w-3 mr-1" />
                Change
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsRemoveOpen(true)}
                className="h-7 px-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
            </div>
          )}
        </div>

        {contact.company ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link
                  href={`/companies/${contact.company.id}`}
                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                >
                  <span>{contact.company.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </Link>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Associated Organization Account
                </p>
              </div>

              {contact.isPrimaryContact && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                  <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                  Primary Contact
                </span>
              )}
            </div>

            <div className="pt-2">
              <Link
                href={`/companies/${contact.company.id}`}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                View Company Profile &rarr;
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center space-y-3">
            <p className="text-xs text-slate-400 italic">No company associated</p>
            {canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDialog}
                className="h-8 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Associate Company
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Associate / Change Company Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {contact.company ? "Change Company" : "Associate Company"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Select a company from your organization to associate with{" "}
              <span className="font-semibold text-slate-700">
                {contact.firstName} {contact.lastName || ""}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Select Company
              </Label>
              <EntityCombobox
                value={selectedCompanyId}
                onChange={(val) => {
                  setSelectedCompanyId(val);
                  if (!val) setIsPrimary(false);
                }}
                placeholder="Search companies..."
                searchPlaceholder="Type to search..."
                clearLabel="No Company"
                fetchOptions={fetchCompanies}
                initialOptions={
                  contact.company
                    ? [{ id: contact.company.id, name: contact.company.name }]
                    : []
                }
              />
            </div>

            {selectedCompanyId && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="primaryContactCheckbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <Label
                  htmlFor="primaryContactCheckbox"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                >
                  Mark as primary contact for this company
                </Label>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={loading}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveCompany}
              disabled={loading}
              className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Company Confirmation Dialog */}
      <Dialog open={isRemoveOpen} onOpenChange={setIsRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remove from Company
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to dissociate{" "}
              <span className="font-semibold text-slate-700">
                {contact.firstName} {contact.lastName || ""}
              </span>{" "}
              from{" "}
              <span className="font-semibold text-slate-700">
                {contact.company?.name}
              </span>
              ? The contact record will NOT be deleted.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-700 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRemoveOpen(false)}
              disabled={loading}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveCompany}
              disabled={loading}
              className="text-xs h-9"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Remove Association
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
