import type { CustomFieldDefinition } from "./custom-fields";

export const LEAD_SOURCES = [
  "website",
  "landing_page",
  "meta_ads",
  "google_ads",
  "whatsapp",
  "instagram",
  "facebook",
  "youtube",
  "walk_in",
  "referral",
  "franchise",
  "events",
  "phone_enquiry",
  "existing_student",
  "other",
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: "Website",
  landing_page: "Landing Page",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  walk_in: "Walk-in",
  referral: "Referral",
  franchise: "Franchise",
  events: "Events",
  phone_enquiry: "Phone Enquiry",
  existing_student: "Existing Student",
  other: "Other",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_STATUS_VARIANTS: Record<
  LeadStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  new: {
    bg: "bg-blue-50/70",
    text: "text-blue-700",
    border: "border-blue-200",
    dot: "bg-blue-500",
  },
  contacted: {
    bg: "bg-amber-50/70",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  qualified: {
    bg: "bg-emerald-50/70",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  unqualified: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  converted: {
    bg: "bg-purple-50/70",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  lost: {
    bg: "bg-rose-50/70",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

export interface Lead {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  assignedToUserId: string | null;
  pipelineId?: string | null;
  stageId?: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface LeadAssignedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface LeadPipelineSummary {
  id: string;
  name: string;
}

export interface LeadStageSummary {
  id: string;
  name: string;
  displayOrder?: number;
}

export interface LeadWithRelations extends Lead {
  assignedToUser?: LeadAssignedUser | null;
  pipeline?: LeadPipelineSummary | null;
  stage?: LeadStageSummary | null;
  customFields?: Record<string, unknown>;
  customFieldValues?: Array<{
    field: CustomFieldDefinition;
    value: unknown;
  }>;
}

export interface LeadPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
