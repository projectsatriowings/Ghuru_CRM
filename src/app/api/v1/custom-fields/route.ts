import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/context/organization-context";
import {
  getCustomFields,
  createCustomField,
} from "@/lib/services/custom-field.service";
import {
  createCustomFieldSchema,
  entityTypeSchema,
} from "@/lib/validations/custom-field";
import { apiSuccess, apiError } from "@/lib/api-response";
import { type EntityType } from "@/lib/types/custom-fields";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission("custom_fields.view");

    const { searchParams } = new URL(req.url);
    const rawEntityType = searchParams.get("entityType");
    const rawActive = searchParams.get("active");

    let entityType: EntityType | undefined;
    if (rawEntityType) {
      entityType = entityTypeSchema.parse(rawEntityType);
    }

    let active: boolean | undefined;
    if (rawActive !== null && rawActive !== undefined) {
      active = rawActive === "true" || rawActive === "1";
    }

    const fields = await getCustomFields(ctx.organization.id, {
      entityType,
      active,
    });

    return apiSuccess(fields);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission("custom_fields.create");

    const body = await req.json();
    const validated = createCustomFieldSchema.parse(body);

    const field = await createCustomField(ctx.organization.id, validated);

    return apiSuccess(field, 201);
  } catch (error) {
    return apiError(error);
  }
}
