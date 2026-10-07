import { NextRequest } from "next/server";
import { db } from "@/db";
import { DbClient } from "@/db/types";
import { authenticateApiKey } from "@/lib/services/integrations/api-key.service";
import { ApiKeyAuthContext, ApiKeyScope } from "@/lib/types/integrations";
import { requirePermission, OrganizationContext } from "./organization-context";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

export interface UnifiedAuthContext {
  isApiKey: boolean;
  organizationId: string;
  user?: OrganizationContext["user"];
  session?: OrganizationContext["session"];
  apiKey?: ApiKeyAuthContext;
}

/**
 * Extracts and authenticates an API key from request headers.
 * Supported headers:
 * - Authorization: Bearer ghk_live_...
 * - x-api-key: ghk_live_...
 */
export async function authenticateApiKeyFromRequest(
  req: NextRequest,
  requiredScope?: ApiKeyScope | string,
  dbInstance: DbClient = db as DbClient
): Promise<ApiKeyAuthContext> {
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");
  if (!authHeader) {
    throw new UnauthorizedError("Missing API key credentials in request header.");
  }

  const authCtx = await authenticateApiKey(authHeader, dbInstance);

  if (requiredScope && !authCtx.hasScope(requiredScope)) {
    throw new ForbiddenError(
      `Forbidden: API key does not have required scope [${requiredScope}].`
    );
  }

  return authCtx;
}

/**
 * Reusable authentication abstraction supporting either interactive user sessions
 * OR programmatic API key requests.
 *
 * If an API key header is detected, validates the key and checks scopes.
 * Otherwise, requires active session auth and checks RBAC permission.
 */
export async function authenticateRequest(
  req: NextRequest,
  options: {
    requiredPermission?: string;
    requiredScope?: ApiKeyScope | string;
    explicitOrgId?: string;
  } = {},
  dbInstance: DbClient = db as DbClient
): Promise<UnifiedAuthContext> {
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key");

  // Check if request provides a Ghuru API key
  if (
    authHeader &&
    (authHeader.includes("ghk_live_") || req.headers.has("x-api-key"))
  ) {
    const apiCtx = await authenticateApiKeyFromRequest(
      req,
      options.requiredScope,
      dbInstance
    );
    return {
      isApiKey: true,
      organizationId: apiCtx.organizationId,
      apiKey: apiCtx,
    };
  }

  // Interactive user session authentication with RBAC
  const userCtx = options.requiredPermission
    ? await requirePermission(options.requiredPermission, options.explicitOrgId)
    : await requirePermission("organization.view", options.explicitOrgId);

  return {
    isApiKey: false,
    organizationId: userCtx.organization.id,
    user: userCtx.user,
    session: userCtx.session,
  };
}
