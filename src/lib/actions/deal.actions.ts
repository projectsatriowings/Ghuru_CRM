"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createDeal,
  updateDeal,
  archiveDeal,
  restoreDeal,
} from "@/lib/services/deal.service";
import {
  type CreateDealInput,
  type UpdateDealInput,
} from "@/lib/validations/deal";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createDealAction(input: CreateDealInput) {
  try {
    const ctx = await requirePermission("deals.create");
    const deal = await createDeal(
      ctx.organization.id,
      input,
      undefined,
      ctx.user.id
    );
    revalidatePath("/deals");
    return { success: true as const, data: deal };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create deal.";
    return { success: false as const, error: message };
  }
}

export async function updateDealAction(
  dealId: string,
  input: UpdateDealInput
) {
  try {
    const ctx = await requirePermission("deals.update");
    const deal = await updateDeal(
      ctx.organization.id,
      dealId,
      input,
      undefined,
      ctx.user.id
    );
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
    return { success: true as const, data: deal };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update deal.";
    return { success: false as const, error: message };
  }
}

export async function archiveDealAction(dealId: string) {
  try {
    const ctx = await requirePermission("deals.delete");
    const deal = await archiveDeal(
      ctx.organization.id,
      dealId,
      undefined,
      ctx.user.id
    );
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
    return { success: true as const, data: deal };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive deal.";
    return { success: false as const, error: message };
  }
}

export async function restoreDealAction(dealId: string) {
  try {
    const ctx = await requirePermission("deals.update");
    const deal = await restoreDeal(
      ctx.organization.id,
      dealId,
      undefined,
      ctx.user.id
    );
    revalidatePath("/deals");
    revalidatePath(`/deals/${dealId}`);
    return { success: true as const, data: deal };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to restore deal.";
    return { success: false as const, error: message };
  }
}
