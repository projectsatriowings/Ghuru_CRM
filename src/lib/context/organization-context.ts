import { cache } from "react";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  organizations,
  organizationMembers,
  roles,
  rolePermissions,
  permissions,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

export interface OrganizationContext {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  };
  membership: {
    id: string;
    roleId: string;
  };
  role: {
    id: string;
    name: string;
  };
  permissionKeys: string[];
  permissions: Set<string>;
  hasPermission: (key: string) => boolean;
}

export const requireAuth = cache(async () => {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session || !session.user) {
    throw new UnauthorizedError("You must be logged in to perform this action.");
  }

  return {
    user: session.user,
    session: session.session,
  };
});

export const getActiveOrgIdFromRequest = cache(async (): Promise<string | undefined> => {
  const reqHeaders = await headers();
  const orgHeader = reqHeaders.get("x-organization-id");
  if (orgHeader) return orgHeader;

  const cookieStore = await cookies();
  const orgCookie = cookieStore.get("ghuru_active_org");
  if (orgCookie?.value) return orgCookie.value;

  return undefined;
});

export const requireOrganization = cache(
  async (explicitOrgId?: string): Promise<OrganizationContext> => {
    const { user, session } = await requireAuth();

    let targetOrgId = explicitOrgId;

    if (!targetOrgId) {
      targetOrgId = await getActiveOrgIdFromRequest();
    }

    // If no explicit or cookie org specified, pick user's first organization
    if (!targetOrgId) {
      const [firstMembership] = await db
        .select({ organizationId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(eq(organizationMembers.userId, user.id))
        .limit(1);

      if (!firstMembership) {
        throw new NotFoundError(
          "No organization membership found. Please create or join an organization."
        );
      }
      targetOrgId = firstMembership.organizationId;
    }

    // Server-side tenant isolation check:
    // Must verify that the user is an active member of targetOrgId
    const [membership] = await db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        roleId: organizationMembers.roleId,
        roleName: roles.name,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        orgCreatedAt: organizations.createdAt,
        orgUpdatedAt: organizations.updatedAt,
      })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizationMembers.organizationId, organizations.id)
      )
      .innerJoin(roles, eq(organizationMembers.roleId, roles.id))
      .where(
        and(
          eq(organizationMembers.organizationId, targetOrgId),
          eq(organizationMembers.userId, user.id)
        )
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenError(
        "Access denied: You are not a member of this organization."
      );
    }

    // Fetch all permissions assigned to this user's role
    const rolePerms = await db
      .select({ key: permissions.key })
      .from(rolePermissions)
      .innerJoin(
        permissions,
        eq(rolePermissions.permissionId, permissions.id)
      )
      .where(eq(rolePermissions.roleId, membership.roleId));

    const permKeys = rolePerms.map((rp) => rp.key);
    const permSet = new Set(permKeys);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        token: session.token,
      },
      organization: {
        id: membership.organizationId,
        name: membership.orgName,
        slug: membership.orgSlug,
        createdAt: membership.orgCreatedAt,
        updatedAt: membership.orgUpdatedAt,
      },
      membership: {
        id: membership.id,
        roleId: membership.roleId,
      },
      role: {
        id: membership.roleId,
        name: membership.roleName,
      },
      permissionKeys: permKeys,
      permissions: permSet,
      hasPermission: (key: string) => permSet.has(key),
    };
  }
);

export async function requirePermission(
  permissionKey: string,
  explicitOrgId?: string
): Promise<OrganizationContext> {
  const ctx = await requireOrganization(explicitOrgId);

  if (!ctx.hasPermission(permissionKey)) {
    throw new ForbiddenError(
      `Forbidden: You do not have the required permission [${permissionKey}] to perform this action.`
    );
  }

  return ctx;
}
