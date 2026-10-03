"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type LeadWithRelations } from "@/lib/types/leads";
import { type DuplicateContactResult } from "@/lib/services/lead.service";
import { convertLeadAction } from "@/lib/actions/lead.actions";
import { EntityCombobox, type ComboboxOption } from "@/components/common/entity-combobox";
import {
  ArrowRightLeft,
  UserPlus,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Phone,
} from "lucide-react";

type ConversionMode = "select" | "create_new" | "link_existing";
type Step = "mode" | "form" | "duplicates";

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadWithRelations;
  onSuccess: () => void;
  /** Fetch existing contacts in this org for the link_existing combobox */
  fetchContacts?: (search: string) => Promise<ComboboxOption[]>;
}

export function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
  fetchContacts,
}: ConvertLeadDialogProps) {
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<ConversionMode>("select");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // create_new form fields
  const [firstName, setFirstName] = useState(lead.firstName);
  const [lastName, setLastName] = useState(lead.lastName ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [conversionNotes, setConversionNotes] = useState("");

  // link_existing
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // duplicates
  const [duplicates, setDuplicates] = useState<DuplicateContactResult[]>([]);

  const defaultFetchContacts = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data.map(
          (c: { id: string; firstName: string; lastName?: string; email?: string }) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName || ""}`.trim(),
            subtext: c.email || undefined,
          })
        );
      }
      return [];
    } catch {
      return [];
    }
  };

  const getContactOptions = fetchContacts || defaultFetchContacts;

  function reset() {
    setStep("mode");
    setMode("select");
    setError(null);
    setFirstName(lead.firstName);
    setLastName(lead.lastName ?? "");
    setEmail(lead.email ?? "");
    setPhone(lead.phone ?? "");
    setConversionNotes("");
    setSelectedContactId(null);
    setDuplicates([]);
  }

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  function handleModeSelect(selected: ConversionMode) {
    setMode(selected);
    setStep("form");
    setError(null);
  }

  function handleSubmitCreateNew(skipDuplicateCheck = false) {
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await convertLeadAction(lead.id, {
        mode: "create_new",
        overrideFirstName: firstName.trim(),
        overrideLastName: lastName.trim() || undefined,
        overrideEmail: email.trim() || undefined,
        overridePhone: phone.trim() || undefined,
        conversionNotes: conversionNotes.trim() || undefined,
        skipDuplicateCheck,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (result.hasDuplicates && result.data?.duplicates?.length) {
        setDuplicates(result.data.duplicates);
        setStep("duplicates");
        return;
      }

      onSuccess();
      handleOpenChange(false);
    });
  }

  function handleSubmitLinkExisting() {
    if (!selectedContactId) {
      setError("Please select a contact to link.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await convertLeadAction(lead.id, {
        mode: "link_existing",
        existingContactId: selectedContactId,
        conversionNotes: conversionNotes.trim() || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess();
      handleOpenChange(false);
    });
  }

  const fullName = `${lead.firstName} ${lead.lastName ?? ""}`.trim();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Mode selection step */}
        {step === "mode" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <ArrowRightLeft className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Convert Lead
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                Convert <span className="font-semibold text-slate-700">{fullName}</span> to a Contact.
                Choose how to proceed.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <button
                id="convert-create-new-btn"
                type="button"
                onClick={() => handleModeSelect("create_new")}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Create New Contact</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create a new Contact record using this lead&apos;s information.
                    </p>
                  </div>
                </div>
              </button>

              <button
                id="convert-link-existing-btn"
                type="button"
                onClick={() => handleModeSelect("link_existing")}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Link Existing Contact</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Link this lead to a Contact that already exists in your CRM.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Create New Contact form */}
        {step === "form" && mode === "create_new" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Create New Contact
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                Review and confirm the contact details. The lead will be marked as{" "}
                <span className="font-medium text-purple-700">Converted</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="conv-firstName" className="text-xs font-semibold text-slate-600">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="conv-firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 h-8 text-sm"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <Label htmlFor="conv-lastName" className="text-xs font-semibold text-slate-600">
                    Last Name
                  </Label>
                  <Input
                    id="conv-lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 h-8 text-sm"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="conv-email" className="text-xs font-semibold text-slate-600">
                  Email Address
                </Label>
                <Input
                  id="conv-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <Label htmlFor="conv-phone" className="text-xs font-semibold text-slate-600">
                  Phone Number
                </Label>
                <Input
                  id="conv-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 h-8 text-sm"
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div>
                <Label htmlFor="conv-notes" className="text-xs font-semibold text-slate-600">
                  Conversion Notes <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <textarea
                  id="conv-notes"
                  value={conversionNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConversionNotes(e.target.value)}
                  className="mt-1 w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-none"
                  rows={2}
                  placeholder="Add any notes about this conversion..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("mode")}
                className="text-xs"
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                id="conv-create-submit-btn"
                onClick={() => handleSubmitCreateNew(false)}
                disabled={isPending}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Converting...</>
                ) : (
                  <><CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Convert Lead</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Link Existing Contact form */}
        {step === "form" && mode === "link_existing" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Link2 className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Link to Existing Contact
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                Search for and select the Contact to link this lead to.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  Select Contact <span className="text-red-500">*</span>
                </Label>
                <EntityCombobox
                  value={selectedContactId}
                  onChange={(val) => setSelectedContactId(val)}
                  placeholder="Search contacts..."
                  searchPlaceholder="Type to search contacts..."
                  emptyText="No contacts found."
                  allowClear={false}
                  fetchOptions={getContactOptions}
                />
              </div>

              <div>
                <Label htmlFor="link-conv-notes" className="text-xs font-semibold text-slate-600">
                  Conversion Notes <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <textarea
                  id="link-conv-notes"
                  value={conversionNotes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setConversionNotes(e.target.value)}
                  className="mt-1 w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all placeholder:text-slate-400 resize-none"
                  rows={2}
                  placeholder="Add any notes about this conversion..."
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("mode")}
                className="text-xs"
                disabled={isPending}
              >
                Back
              </Button>
              <Button
                id="link-contact-submit-btn"
                onClick={() => handleSubmitLinkExisting()}
                disabled={isPending}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Linking...</>
                ) : (
                  <><Link2 className="h-3.5 w-3.5 mr-1" /> Link Contact</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Duplicate contact warning step */}
        {step === "duplicates" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Possible Duplicate Contacts
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-slate-500 leading-relaxed">
                We found existing contacts with matching email or phone. Review them before
                proceeding.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  className="p-3 rounded-lg border border-amber-200 bg-amber-50/60"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {dup.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {dup.firstName}{dup.lastName ? ` ${dup.lastName}` : ""}
                      </p>
                      {dup.email && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3" /> {dup.email}
                        </p>
                      )}
                      {dup.phone && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                          <Phone className="h-3 w-3" /> {dup.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-600 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="font-semibold">Do you still want to create a new contact?</span>
              {" "}You can also go back and link to one of the existing contacts above.
            </p>

            <DialogFooter className="mt-4 gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setStep("mode")}
                className="text-xs"
                disabled={isPending}
              >
                <User className="h-3.5 w-3.5 mr-1" />
                Link Existing Instead
              </Button>
              <Button
                id="conv-force-create-btn"
                onClick={() => handleSubmitCreateNew(true)}
                disabled={isPending}
                className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Creating...</>
                ) : (
                  <>Create Anyway</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
