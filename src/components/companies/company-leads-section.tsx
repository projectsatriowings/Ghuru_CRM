"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CompanyLeadItem } from "@/lib/types/companies";
import {
  associateLeadToCompanyAction,
  removeLeadFromCompanyAction,
} from "@/lib/actions/company.actions";
import {
  EntityCombobox,
  type ComboboxOption,
} from "@/components/common/entity-combobox";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
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
  Briefcase,
  Plus,
  Mail,
  Phone,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  User,
  GitBranch,
} from "lucide-react";
import { type LeadStatus } from "@/lib/types/leads";

interface CompanyLeadsSectionProps {
  companyId: string;
  companyName: string;
  leads: CompanyLeadItem[];
  canUpdateLeads: boolean;
}

export function CompanyLeadsSection({
  companyId,
  companyName,
  leads,
  canUpdateLeads,
}: CompanyLeadsSectionProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [removeLead, setRemoveLead] = useState<CompanyLeadItem | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeadOptions = async (query: string): Promise<ComboboxOption[]> => {
    try {
      const res = await fetch(
        `/api/v1/leads?search=${encodeURIComponent(query)}&pageSize=20&archived=false`
      );
      const json = await res.json();
      if (json.success && json.data) {
        return json.data
          .filter((l: { id: string }) => !leads.some((existing) => existing.id === l.id))
          .map((l: { id: string; firstName: string; lastName?: string; email?: string }) => ({
            id: l.id,
            name: `${l.firstName} ${l.lastName || ""}`.trim(),
            subtext: l.email || undefined,
          }));
      }
      return [];
    } catch {
      return [];
    }
  };

  const handleAssociateLead = async () => {
    if (!selectedLeadId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await associateLeadToCompanyAction(companyId, selectedLeadId);

      if (!res.success) {
        setError(res.error || "Failed to associate lead.");
        setLoading(false);
        return;
      }

      setIsAddOpen(false);
      setSelectedLeadId(null);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to associate lead."
      );
      setLoading(false);
    }
  };

  const handleRemoveLead = async () => {
    if (!removeLead || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await removeLeadFromCompanyAction(companyId, removeLead.id);

      if (!res.success) {
        setError(res.error || "Failed to remove lead.");
        setLoading(false);
        return;
      }

      setRemoveLead(null);
      setLoading(false);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to remove lead."
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
            <Briefcase className="h-4 w-4 text-indigo-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Leads ({leads.length})
            </h2>
          </div>

          {canUpdateLeads && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedLeadId(null);
                setError(null);
                setIsAddOpen(true);
              }}
              className="h-8 px-2.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-100 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Associate Lead
            </Button>
          )}
        </div>

        {/* Leads List / Empty State */}
        {leads.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <Briefcase className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-400 italic">
              No leads associated with this company
            </p>
            {canUpdateLeads && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedLeadId(null);
                  setError(null);
                  setIsAddOpen(true);
                }}
                className="h-8 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Associate Lead
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {leads.map((lead) => {
              const fullName = `${lead.firstName} ${lead.lastName || ""}`.trim();
              return (
                <div
                  key={lead.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 sm:mt-0">
                      {lead.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {fullName}
                        </Link>
                        <LeadStatusBadge status={lead.status as LeadStatus} />
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                        {lead.email && (
                          <a
                            href={`mailto:${lead.email}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600"
                          >
                            <Mail className="h-3 w-3 text-slate-400" />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600"
                          >
                            <Phone className="h-3 w-3 text-slate-400" />
                            {lead.phone}
                          </a>
                        )}
                        {lead.pipeline && lead.stage && (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <GitBranch className="h-3 w-3 text-slate-400" />
                            {lead.pipeline.name} &rsaquo; {lead.stage.name}
                          </span>
                        )}
                        {lead.assignedUser && (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <User className="h-3 w-3" />
                            {lead.assignedUser.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Link href={`/leads/${lead.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>

                    {canUpdateLeads && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoveLead(lead)}
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

      {/* Associate Lead Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Associate Lead with {companyName}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Search and associate an existing lead from your organization.
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
                Search Lead
              </Label>
              <EntityCombobox
                value={selectedLeadId}
                onChange={setSelectedLeadId}
                placeholder="Search by lead name or email..."
                searchPlaceholder="Type lead name..."
                clearLabel="None"
                fetchOptions={fetchLeadOptions}
              />
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
              onClick={handleAssociateLead}
              disabled={!selectedLeadId || loading}
              className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Associate Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Lead Confirmation Dialog */}
      <Dialog
        open={Boolean(removeLead)}
        onOpenChange={(open) => !open && setRemoveLead(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remove Lead from Company
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-slate-700">
                {removeLead?.firstName} {removeLead?.lastName || ""}
              </span>{" "}
              from {companyName}? The lead record itself will NOT be deleted.
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
              onClick={() => setRemoveLead(null)}
              disabled={loading}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemoveLead}
              disabled={loading}
              className="text-xs h-9"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Remove Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
