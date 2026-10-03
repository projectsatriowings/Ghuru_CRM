import type { CustomFieldDefinition } from "./custom-fields";

export interface Contact {
  id: string;
  organizationId: string;
  companyId: string | null;
  isPrimaryContact: boolean;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ownerUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}

export interface ContactOwnerUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ContactCompany {
  id: string;
  name: string;
}

export interface ContactWithRelations extends Contact {
  ownerUser?: ContactOwnerUser | null;
  company?: ContactCompany | null;
  customFields?: Record<string, unknown>;
  customFieldValues?: Array<{
    field: CustomFieldDefinition;
    value: unknown;
  }>;
}

export interface ContactPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedContactsResult {
  data: ContactWithRelations[];
  pagination: ContactPagination;
}

export interface ContactQueryParams {
  search?: string;
  ownerId?: string;
  archived?: "true" | "false" | "all";
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "updatedAt" | "firstName" | "lastName";
  sortDirection?: "asc" | "desc";
}
