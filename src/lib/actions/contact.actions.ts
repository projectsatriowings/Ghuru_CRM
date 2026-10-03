"use server";

import { requirePermission } from "@/lib/context/organization-context";
import {
  createContact,
  updateContact,
  archiveContact,
  restoreContact,
} from "@/lib/services/contact.service";
import {
  type CreateContactInput,
  type UpdateContactInput,
} from "@/lib/validations/contact";
import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";

export async function createContactAction(input: CreateContactInput) {
  try {
    const ctx = await requirePermission("contacts.create");
    const contact = await createContact(ctx.organization.id, input);
    revalidatePath("/contacts");
    return { success: true as const, data: contact };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to create contact.";
    return { success: false as const, error: message };
  }
}

export async function updateContactAction(
  contactId: string,
  input: UpdateContactInput
) {
  try {
    const ctx = await requirePermission("contacts.update");
    const contact = await updateContact(ctx.organization.id, contactId, input);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { success: true as const, data: contact };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to update contact.";
    return { success: false as const, error: message };
  }
}

export async function archiveContactAction(contactId: string) {
  try {
    const ctx = await requirePermission("contacts.delete");
    const contact = await archiveContact(ctx.organization.id, contactId);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { success: true as const, data: contact };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to archive contact.";
    return { success: false as const, error: message };
  }
}

export async function restoreContactAction(contactId: string) {
  try {
    const ctx = await requirePermission("contacts.update");
    const contact = await restoreContact(ctx.organization.id, contactId);
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${contactId}`);
    return { success: true as const, data: contact };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false as const, error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "Failed to restore contact.";
    return { success: false as const, error: message };
  }
}
