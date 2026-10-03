import type { CustomFieldDefinition } from "./custom-fields";

export interface Company {
  id: string;
  organizationId: string;
  name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  companySize: string | null;
  ownerUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface CompanyOwnerUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface CompanyWithRelations extends Company {
  ownerUser?: CompanyOwnerUser | null;
  contactCount?: number;
  leadCount?: number;
  primaryContact?: {
    id: string;
    firstName: string;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  customFields?: Record<string, unknown>;
  customFieldValues?: Array<{
    field: CustomFieldDefinition;
    value: unknown;
  }>;
}

export interface CompanyContactItem {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isPrimaryContact: boolean;
  ownerUser?: CompanyOwnerUser | null;
  createdAt: Date;
}

export interface CompanyLeadItem {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  pipeline?: { id: string; name: string } | null;
  stage?: { id: string; name: string } | null;
  assignedUser?: CompanyOwnerUser | null;
  createdAt: Date;
}

export interface CompanyPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedCompaniesResult {
  data: CompanyWithRelations[];
  pagination: CompanyPagination;
}

export interface CompanyQueryParams {
  search?: string;
  ownerId?: string;
  archived?: "true" | "false" | "all";
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "updatedAt" | "name" | "industry";
  sortDirection?: "asc" | "desc";
}
