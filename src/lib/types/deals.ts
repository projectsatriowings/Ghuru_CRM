import { DEAL_STATUSES, type DealStatus } from "@/db/schema/deals";
import {
  type CustomFieldDefinition,
} from "@/lib/types/custom-fields";

export { DEAL_STATUSES, type DealStatus };

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

export interface DealUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface DealPipelineSummary {
  id: string;
  name: string;
}

export interface DealStageSummary {
  id: string;
  name: string;
  displayOrder?: number;
}

export interface DealLeadSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export interface DealContactSummary {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export interface DealCompanySummary {
  id: string;
  name: string;
}

export interface DealCustomFieldValueWithDef {
  field: CustomFieldDefinition;
  value: unknown;
}

export interface DealWithRelations {
  id: string;
  organizationId: string;
  name: string;
  leadId: string | null;
  contactId: string | null;
  companyId: string | null;
  ownerUserId: string | null;
  pipelineId: string;
  pipelineStageId: string;
  value: string | number | null;
  currency: string;
  expectedCloseDate: Date | null;
  status: DealStatus;
  probability: number | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;

  // Joined relations
  ownerUser: DealUser | null;
  pipeline: DealPipelineSummary;
  stage: DealStageSummary;
  lead: DealLeadSummary | null;
  contact: DealContactSummary | null;
  company: DealCompanySummary | null;

  // Custom fields
  customFields: Record<string, unknown>;
  customFieldValues: DealCustomFieldValueWithDef[];
}

export interface DealPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedDealsResult {
  data: DealWithRelations[];
  pagination: DealPagination;
}
