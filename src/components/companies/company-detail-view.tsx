"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CompanyWithRelations } from "@/lib/types/companies";
import { ArchiveCompanyDialog } from "./archive-company-dialog";
import { CompanyContactsSection } from "./company-contacts-section";
import { CompanyLeadsSection } from "./company-leads-section";
import { CustomFieldValueDisplay } from "@/components/custom-fields/custom-field-renderer";
import { type CompanyContactItem, type CompanyLeadItem } from "@/lib/types/companies";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Edit2,
  Archive,
  RotateCcw,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  FileText,
  SlidersHorizontal,
  Building,
  Star,
} from "lucide-react";

interface CompanyDetailViewProps {
  company: CompanyWithRelations;
  contacts?: CompanyContactItem[];
  leads?: CompanyLeadItem[];
  canUpdate: boolean;
  canDelete: boolean;
  canUpdateContacts?: boolean;
  canUpdateLeads?: boolean;
}

export function CompanyDetailView({
  company,
  contacts = [],
  leads = [],
  canUpdate,
  canDelete,
  canUpdateContacts = true,
  canUpdateLeads = true,
}: CompanyDetailViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");

  const isArchived = Boolean(company.archivedAt);

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/companies"
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {company.name}
              </h1>
              {isArchived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Company ID: <span className="font-mono text-slate-600">{company.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {canUpdate && (
            <Link href={`/companies/${company.id}/edit`}>
              <Button
                variant="outline"
                className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Company
              </Button>
            </Link>
          )}

          {isArchived ? (
            <Button
              variant="outline"
              onClick={() => {
                setDialogMode("restore");
                setIsDialogOpen(true);
              }}
              className="h-9 px-3.5 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50 rounded-lg gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Company
            </Button>
          ) : (
            canDelete && (
              <Button
                variant="outline"
                onClick={() => {
                  setDialogMode("archive");
                  setIsDialogOpen(true);
                }}
                className="h-9 px-3.5 text-xs font-medium text-amber-700 border-amber-200 hover:bg-amber-50 rounded-lg gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive Company
              </Button>
            )
          )}
        </div>
      </div>

      {/* Main Grid: Left Column (Details, Notes, Custom Fields) & Right Column (Sidebar Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Information */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Company Information
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Company Name
                </span>
                <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                  {company.name}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Website URL
                </span>
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mt-0.5"
                  >
                    <Globe className="h-3.5 w-3.5 text-slate-400" />
                    {company.website}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic mt-0.5 block">
                    Not provided
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Corporate Email
                </span>
                {company.email ? (
                  <a
                    href={`mailto:${company.email}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mt-0.5"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {company.email}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic mt-0.5 block">
                    Not provided
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Phone Number
                </span>
                {company.phone ? (
                  <a
                    href={`tel:${company.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mt-0.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {company.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic mt-0.5 block">
                    Not provided
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Industry
                </span>
                <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                  {company.industry || (
                    <span className="text-slate-400 font-normal italic">None</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Company Size
                </span>
                <span className="text-xs font-medium text-slate-800 mt-0.5 block">
                  {company.companySize || (
                    <span className="text-slate-400 font-normal italic">None</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Notes & Description
              </h2>
            </div>
            <div className="p-5">
              {company.notes ? (
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {company.notes}
                </p>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  No notes recorded for this company.
                </span>
              )}
            </div>
          </div>

          {/* Additional Information (Custom Fields) */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-purple-600" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Custom Fields
                </h2>
              </div>
              <Link
                href="/settings/custom-fields"
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Configure fields
              </Link>
            </div>
            <div className="p-5">
              {!company.customFieldValues || company.customFieldValues.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400">
                    No custom fields configured for Companies in this organization.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {company.customFieldValues.map((entry) => (
                    <div
                      key={entry.field.id}
                      className={
                        entry.field.fieldType === "textarea" ? "sm:col-span-2" : ""
                      }
                    >
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1">
                        {entry.field.label}
                      </span>
                      <CustomFieldValueDisplay
                        field={entry.field}
                        value={entry.value}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Contacts Section */}
          <CompanyContactsSection
            companyId={company.id}
            companyName={company.name}
            contacts={contacts}
            canUpdateContacts={canUpdateContacts}
          />

          {/* Leads Section */}
          <CompanyLeadsSection
            companyId={company.id}
            companyName={company.name}
            leads={leads}
            canUpdateLeads={canUpdateLeads}
          />
        </div>

        {/* Right Column (Sidebar Summary) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100">
              Account Overview
            </h3>

            {/* Account Owner */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Owner
              </span>
              {company.ownerUser ? (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {company.ownerUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {company.ownerUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {company.ownerUser.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-400 italic border border-dashed border-slate-200">
                  Unassigned
                </div>
              )}
            </div>

            {/* Primary Contact */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Primary Contact
              </span>
              {company.primaryContact ? (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500 shrink-0" />
                  <div className="overflow-hidden">
                    <Link
                      href={`/contacts/${company.primaryContact.id}`}
                      className="text-xs font-semibold text-slate-900 hover:text-blue-600 block truncate"
                    >
                      {company.primaryContact.firstName}{" "}
                      {company.primaryContact.lastName || ""}
                    </Link>
                    {company.primaryContact.email && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {company.primaryContact.email}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-400 italic border border-dashed border-slate-200">
                  No primary contact
                </div>
              )}
            </div>

            {/* Relationship Counts */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Contacts
                </span>
                <span className="text-base font-bold text-slate-900">
                  {company.contactCount ?? contacts.length}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Leads
                </span>
                <span className="text-base font-bold text-slate-900">
                  {company.leadCount ?? leads.length}
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Created
                </span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  {new Date(company.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Updated
                </span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  {new Date(company.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {isArchived && company.archivedAt && (
                <div className="flex items-center justify-between text-xs pt-1 text-amber-700">
                  <span className="flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" /> Archived
                  </span>
                  <span className="font-medium font-mono text-[11px]">
                    {new Date(company.archivedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archive / Restore Dialog */}
      <ArchiveCompanyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        company={company}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
