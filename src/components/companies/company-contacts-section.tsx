"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CompanyContactItem } from "@/lib/types/companies";
import {
  associateContactToCompanyAction,
  removeContactFromCompanyAction,
  setPrimaryContactAction,
} from "@/lib/actions/company.actions";
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
  Users,
  Plus,
  Mail,
  Phone,
  Star,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";

interface CompanyContactsSectionProps {
  companyId: string;
  companyName: string;
  contacts: CompanyContactItem[];
  canUpdateContacts: boolean;
}

export function CompanyContactsSection({
  companyId,
  companyName,
  contacts,
  canUpdateContacts,
}: CompanyContactsSectionProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeContact, setRemoveContact] = useState<CompanyContactItem | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContactOptions = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data
          .filter((c: { id: string }) => !contacts.some((existing) => existing.id === c.id))
          .map((c: { id: string; firstName: string; lastName?: string; email?: string }) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName || ""}`.trim(),
            subtext: c.email || undefined,
          }));
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleAddContact = async () => {
    if (!selectedContactId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await associateContactToCompanyAction(
        companyId,
        selectedContactId,
        isPrimary
      );

      if (!res.success) {
        setError(res.error || "Failed to associate contact.");
        setLoading(false);
        return;
      }

      setIsAddOpen(false);
      setSelectedContactId(null);
      setIsPrimary(false);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to associate contact."
      );
      setLoading(false);
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await setPrimaryContactAction(companyId, contactId);
      if (!res.success) {
        alert(res.error || "Failed to set primary contact.");
      }
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to set primary contact.");
      setLoading(false);
    }
  };

  const handleRemoveContact = async () => {
    if (!removeContact || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await removeContactFromCompanyAction(
        companyId,
        removeContact.id
      );

      if (!res.success) {
        setError(res.error || "Failed to remove contact.");
        setLoading(false);
        return;
      }

      setRemoveContact(null);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to remove contact."
      );
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Contacts ({contacts.length})
            </h2>
          </div>

          {canUpdateContacts && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedContactId(null);
                setIsPrimary(false);
                setError(null);
                setIsAddOpen(true);
              }}
              className="h-8 px-2.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-100 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </Button>
          )}
        </div>

        {/* Contacts List / Empty State */}
        {contacts.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <Users className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-400 italic">No contacts yet</p>
            {canUpdateContacts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedContactId(null);
                  setIsPrimary(false);
                  setError(null);
                  setIsAddOpen(true);
                }}
                className="h-8 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Existing Contact
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contacts.map((contact) => {
              const fullName = `${contact.firstName} ${contact.lastName || ""}`.trim();
              return (
                <div
                  key={contact.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 sm:mt-0">
                      {contact.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {fullName}
                        </Link>
                        {contact.isPrimaryContact && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                            Primary
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                        {contact.email && (
                          <a
                            href={`mailto:${contact.email}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600"
                          >
                            <Mail className="h-3 w-3 text-slate-400" />
                            {contact.email}
                          </a>
                        )}
                        {contact.phone && (
                          <a
                            href={`tel:${contact.phone}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600"
                          >
                            <Phone className="h-3 w-3 text-slate-400" />
                            {contact.phone}
                          </a>
                        )}
                        {contact.ownerUser && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <User className="h-3 w-3" />
                            {contact.ownerUser.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link href={`/contacts/${contact.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>

                    {canUpdateContacts && !contact.isPrimaryContact && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetPrimary(contact.id)}
                        disabled={loading}
                        className="h-7 px-2 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Primary
                      </Button>
                    )}

                    {canUpdateContacts && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoveContact(contact)}
                        disabled={loading}
                        className="h-7 px-2 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Associate Contact Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Add Contact to {companyName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Search and associate an existing contact with this company.
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
                Search Contact
              </Label>
              <EntityCombobox
                value={selectedContactId}
                onChange={setSelectedContactId}
                placeholder="Search by name or email..."
                searchPlaceholder="Type contact name..."
                clearLabel="None"
                fetchOptions={fetchContactOptions}
              />
            </div>

            {selectedContactId && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="addPrimaryCheckbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <Label
                  htmlFor="addPrimaryCheckbox"
                  className="text-xs font-medium text-slate-700 cursor-pointer select-none"
                >
                  Set as primary contact for {companyName}
                </Label>
              </div>
            )}

            <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
              Need to create a brand new contact?{" "}
              <Link
                href="/contacts/new"
                className="text-blue-600 font-semibold hover:underline"
              >
                Create new contact &rarr;
              </Link>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              disabled={loading}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAddContact}
              disabled={!selectedContactId || loading}
              className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Associate Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Contact Confirmation Dialog */}
      <Dialog
        open={Boolean(removeContact)}
        onOpenChange={(open) => !open && setRemoveContact(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remove Contact from Company
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-slate-700">
                {removeContact?.firstName} {removeContact?.lastName || ""}
              </span>{" "}
              from {companyName}? The contact record itself will NOT be deleted.
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
              onClick={() => setRemoveContact(null)}
              disabled={loading}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveContact}
              disabled={loading}
              className="text-xs h-9"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Remove Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
