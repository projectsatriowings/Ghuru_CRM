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
