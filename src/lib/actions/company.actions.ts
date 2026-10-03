"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createCompany,
  updateCompany,
  archiveCompany,
  restoreCompany,
} from "@/lib/services/company.service";
import {
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from "@/lib/validations/company";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createCompanyAction(input: CreateCompanyInput) {
  try {
    const ctx = await requirePermission("companies.create");
    const company = await createCompany(ctx.organization.id, input);
    revalidatePath("/companies");
    return { success: true as const, data: company };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create company.";
    return { success: false as const, error: message };
  }
}

export async function updateCompanyAction(
  companyId: string,
  input: UpdateCompanyInput
) {
  try {
    const ctx = await requirePermission("companies.update");
    const company = await updateCompany(ctx.organization.id, companyId, input);
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return { success: true as const, data: company };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update company.";
    return { success: false as const, error: message };
  }
}

export async function archiveCompanyAction(companyId: string) {
  try {
    const ctx = await requirePermission("companies.delete");
    const company = await archiveCompany(ctx.organization.id, companyId);
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return { success: true as const, data: company };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive company.";
    return { success: false as const, error: message };
  }
}

export async function restoreCompanyAction(companyId: string) {
  try {
    const ctx = await requirePermission("companies.update");
    const company = await restoreCompany(ctx.organization.id, companyId);
    revalidatePath("/companies");
    revalidatePath(`/companies/${companyId}`);
    return { success: true as const, data: company };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to restore company.";
    return { success: false as const, error: message };
  }
}

export async function associateContactToCompanyAction(
  companyId: string,
  contactId: string,
  isPrimaryContact: boolean = false
) {
  try {
    const ctx = await requirePermission("contacts.update");
    const { setContactCompany } = await import("@/lib/services/company.service");
    await setContactCompany(
      ctx.organization.id,
      contactId,
      companyId,
      isPrimaryContact
    );
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to associate contact.";
    return { success: false as const, error: message };
  }
}

export async function removeContactFromCompanyAction(
  companyId: string,
  contactId: string
) {
  try {
    const ctx = await requirePermission("contacts.update");
    const { removeContactFromCompany } = await import(
      "@/lib/services/company.service"
    );
    await removeContactFromCompany(ctx.organization.id, contactId);
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/contacts/${contactId}`);
    revalidatePath("/contacts");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to remove contact.";
    return { success: false as const, error: message };
  }
}

export async function setPrimaryContactAction(
  companyId: string,
  contactId: string
) {
  try {
    const ctx = await requirePermission("contacts.update");
    const { setPrimaryContact } = await import(
      "@/lib/services/company.service"
    );
    await setPrimaryContact(ctx.organization.id, companyId, contactId);
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/contacts/${contactId}`);
    return { success: true as const };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to set primary contact.";
    return { success: false as const, error: message };
  }
}

export async function associateLeadToCompanyAction(
  companyId: string,
  leadId: string
) {
  try {
    const ctx = await requirePermission("leads.update");
    const { setLeadCompany } = await import("@/lib/services/company.service");
    await setLeadCompany(ctx.organization.id, leadId, companyId);
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to associate lead.";
    return { success: false as const, error: message };
  }
}

export async function removeLeadFromCompanyAction(
  companyId: string,
  leadId: string
) {
  try {
    const ctx = await requirePermission("leads.update");
    const { removeLeadFromCompany } = await import(
      "@/lib/services/company.service"
    );
    await removeLeadFromCompany(ctx.organization.id, leadId);
    revalidatePath(`/companies/${companyId}`);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
    return { success: true as const };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to remove lead.";
    return { success: false as const, error: message };
  }
}
