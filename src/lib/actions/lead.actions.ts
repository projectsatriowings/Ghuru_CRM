"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createLead,
  updateLead,
  archiveLead,
  restoreLead,
} from "@/lib/services/lead.service";
import {
  type CreateLeadInput,
  type UpdateLeadInput,
} from "@/lib/validations/lead";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createLeadAction(input: CreateLeadInput) {
  try {
    const ctx = await requirePermission("leads.create");
    const lead = await createLead(ctx.organization.id, input);
    revalidatePath("/leads");
    return { success: true as const, data: lead };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create lead.";
    return { success: false as const, error: message };
  }
}

export async function updateLeadAction(
  leadId: string,
  input: UpdateLeadInput
) {
  try {
    const ctx = await requirePermission("leads.update");
    const lead = await updateLead(ctx.organization.id, leadId, input);
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { success: true as const, data: lead };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update lead.";
    return { success: false as const, error: message };
  }
}

export async function archiveLeadAction(leadId: string) {
  try {
    const ctx = await requirePermission("leads.delete");
    const lead = await archiveLead(ctx.organization.id, leadId);
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { success: true as const, data: lead };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive lead.";
    return { success: false as const, error: message };
  }
}

export async function restoreLeadAction(leadId: string) {
  try {
    const ctx = await requirePermission("leads.update");
    const lead = await restoreLead(ctx.organization.id, leadId);
    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { success: true as const, data: lead };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to restore lead.";
    return { success: false as const, error: message };
  }
}
