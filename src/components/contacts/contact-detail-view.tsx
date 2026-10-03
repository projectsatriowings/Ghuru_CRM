"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ContactWithRelations } from "@/lib/types/contacts";
import { ArchiveContactDialog } from "./archive-contact-dialog";
import { CustomFieldValueDisplay } from "@/components/custom-fields/custom-field-renderer";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Edit2,
  Archive,
  RotateCcw,
  Mail,
  Phone,
  User,
  Calendar,
  Clock,
  FileText,
  SlidersHorizontal,
} from "lucide-react";

interface ContactDetailViewProps {
  contact: ContactWithRelations;
  canUpdate: boolean;
  canDelete: boolean;
}

export function ContactDetailView({
  contact,
  canUpdate,
  canDelete,
}: ContactDetailViewProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"archive" | "restore">("archive");

  const fullName = `${contact.firstName} ${contact.lastName || ""}`.trim();
  const isArchived = Boolean(contact.archivedAt);

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/contacts"
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {fullName}
              </h1>
              {isArchived && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  Archived
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Contact ID: <span className="font-mono text-slate-600">{contact.id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {canUpdate && (
            <Link href={`/contacts/${contact.id}/edit`}>
              <Button
                variant="outline"
                className="h-9 px-3.5 text-xs font-medium text-slate-700 border-slate-200 hover:bg-slate-50 rounded-lg gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Contact
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
              Restore Contact
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
                Archive Contact
              </Button>
            )
          )}
        </div>
      </div>

      {/* Main Grid: Left Column (Details, Notes, Custom Fields) & Right Column (Sidebar Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <User className="h-4 w-4 text-blue-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Contact Information
              </h2>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  First Name
                </span>
                <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                  {contact.firstName}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Last Name
                </span>
                <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                  {contact.lastName || (
                    <span className="text-slate-400 font-normal italic">None</span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                  Email Address
                </span>
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mt-0.5"
                  >
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {contact.email}
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
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline mt-0.5"
                  >
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {contact.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 italic mt-0.5 block">
                    Not provided
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Notes
              </h2>
            </div>
            <div className="p-5">
              {contact.notes ? (
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {contact.notes}
                </p>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  No notes recorded for this contact.
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
              {!contact.customFieldValues || contact.customFieldValues.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-xs text-slate-400">
                    No custom fields configured for Contacts in this organization.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {contact.customFieldValues.map((entry) => (
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
        </div>

        {/* Right Column (Sidebar Summary) */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-slate-100">
              Contact Overview
            </h3>

            {/* Contact Owner */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider mb-1.5">
                Owner
              </span>
              {contact.ownerUser ? (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                    {contact.ownerUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {contact.ownerUser.name}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {contact.ownerUser.email}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-400 italic border border-dashed border-slate-200">
                  Unassigned
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Created
                </span>
                <span className="font-medium text-slate-700 font-mono text-[11px]">
                  {new Date(contact.createdAt).toLocaleDateString(undefined, {
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
                  {new Date(contact.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              {isArchived && contact.archivedAt && (
                <div className="flex items-center justify-between text-xs pt-1 text-amber-700">
                  <span className="flex items-center gap-1.5">
                    <Archive className="h-3.5 w-3.5" /> Archived
                  </span>
                  <span className="font-medium font-mono text-[11px]">
                    {new Date(contact.archivedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archive / Restore Dialog */}
      <ArchiveContactDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        contact={contact}
        mode={dialogMode}
        onSuccess={() => {
          setIsDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
