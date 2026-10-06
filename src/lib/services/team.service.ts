import { db } from "@/db";
import { DbClient } from "@/db/types";
import { teams, teamMembers } from "@/db/schema/teams";
import { organizationMembers } from "@/db/schema/organizations";
import { users } from "@/db/schema/users";
import { eq, and, isNull, asc } from "drizzle-orm";
import {
  createTeamSchema,
  updateTeamSchema,
  addTeamMemberSchema,
  type CreateTeamInput,
  type UpdateTeamInput,
  type AddTeamMemberInput,
} from "@/lib/validations/team";
import { type Team, type TeamWithMembers, type TeamMemberInfo } from "@/lib/types/teams";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

export async function createTeam(
  organizationId: string,
  input: CreateTeamInput,
  dbInstance: DbClient = db as DbClient
): Promise<Team> {
  const validated = createTeamSchema.parse(input);

  const [existing] = await dbInstance
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.organizationId, organizationId),
        eq(teams.name, validated.name),
        isNull(teams.archivedAt)
      )
    )
    .limit(1);

  if (existing) {
    throw new ConflictError(`A team with the name "${validated.name}" already exists.`);
  }

  const teamId = crypto.randomUUID();

  const [created] = await dbInstance
    .insert(teams)
    .values({
      id: teamId,
      organizationId,
      name: validated.name,
      description: validated.description || null,
    })
    .returning();

  return created;
}

export async function getTeams(
  organizationId: string,
  options?: { includeArchived?: boolean },
  dbInstance: DbClient = db as DbClient
): Promise<TeamWithMembers[]> {
  const conditions = [eq(teams.organizationId, organizationId)];
  if (!options?.includeArchived) {
    conditions.push(isNull(teams.archivedAt));
  }

  const teamRows = await dbInstance
    .select()
    .from(teams)
    .where(and(...conditions))
    .orderBy(asc(teams.name));

  if (teamRows.length === 0) {
    return [];
  }

  // Fetch all members for these teams
  const memberRows = await dbInstance
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      createdAt: teamMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.organizationId, organizationId));

  const membersByTeam = new Map<string, TeamMemberInfo[]>();
  for (const m of memberRows) {
    const list = membersByTeam.get(m.teamId) || [];
    list.push({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      createdAt: m.createdAt,
    });
    membersByTeam.set(m.teamId, list);
  }

  return teamRows.map((t) => {
    const members = membersByTeam.get(t.id) || [];
    return {
      ...t,
      memberCount: members.length,
      members,
    };
  });
}

export async function getTeamById(
  organizationId: string,
  teamId: string,
  dbInstance: DbClient = db as DbClient
): Promise<TeamWithMembers> {
  const [team] = await dbInstance
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.id, teamId),
        eq(teams.organizationId, organizationId),
        isNull(teams.archivedAt)
      )
    )
    .limit(1);

  if (!team) {
    throw new NotFoundError(`Team with id "${teamId}" not found.`);
  }

  const memberRows = await dbInstance
    .select({
      id: teamMembers.id,
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      createdAt: teamMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.organizationId, organizationId)
      )
    );

  const members: TeamMemberInfo[] = memberRows.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.name,
    email: m.email,
    createdAt: m.createdAt,
  }));

  return {
    ...team,
    memberCount: members.length,
    members,
  };
}

export async function updateTeam(
  organizationId: string,
  teamId: string,
  input: UpdateTeamInput,
  dbInstance: DbClient = db as DbClient
): Promise<Team> {
  const validated = updateTeamSchema.parse(input);

  const existingTeam = await getTeamById(organizationId, teamId, dbInstance);

  if (validated.name && validated.name !== existingTeam.name) {
    const [nameConflict] = await dbInstance
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          eq(teams.organizationId, organizationId),
          eq(teams.name, validated.name),
          isNull(teams.archivedAt)
        )
      )
      .limit(1);

    if (nameConflict) {
      throw new ConflictError(`A team with the name "${validated.name}" already exists.`);
    }
  }

  const [updated] = await dbInstance
    .update(teams)
    .set({
      ...(validated.name ? { name: validated.name } : {}),
      ...(validated.description !== undefined ? { description: validated.description } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teams.id, teamId),
        eq(teams.organizationId, organizationId),
        isNull(teams.archivedAt)
      )
    )
    .returning();

  return updated;
}

export async function archiveTeam(
  organizationId: string,
  teamId: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  const existingTeam = await getTeamById(organizationId, teamId, dbInstance);

  await dbInstance
    .update(teams)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teams.id, existingTeam.id),
        eq(teams.organizationId, organizationId)
      )
    );
}

export async function addTeamMember(
  organizationId: string,
  teamId: string,
  input: AddTeamMemberInput,
  dbInstance: DbClient = db as DbClient
): Promise<TeamMemberInfo> {
  const validated = addTeamMemberSchema.parse(input);

  // 1. Verify team exists and is active
  await getTeamById(organizationId, teamId, dbInstance);

  // 2. Verify user is a member of the organization
  const [orgMember] = await dbInstance
    .select({
      userId: organizationMembers.userId,
      userName: users.name,
      userEmail: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, validated.userId)
      )
    )
    .limit(1);

  if (!orgMember) {
    throw new ValidationError(`User is not a member of this organization.`);
  }

  // 3. Check if already a member of the team
  const [existingMember] = await dbInstance
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, validated.userId)
      )
    )
    .limit(1);

  if (existingMember) {
    throw new ConflictError(`User is already a member of this team.`);
  }

  const membershipId = crypto.randomUUID();
  const [created] = await dbInstance
    .insert(teamMembers)
    .values({
      id: membershipId,
      organizationId,
      teamId,
      userId: validated.userId,
    })
    .returning();

  return {
    id: created.id,
    userId: orgMember.userId,
    name: orgMember.userName,
    email: orgMember.userEmail,
    createdAt: created.createdAt,
  };
}

export async function removeTeamMember(
  organizationId: string,
  teamId: string,
  userId: string,
  dbInstance: DbClient = db as DbClient
): Promise<void> {
  // Verify team exists
  await getTeamById(organizationId, teamId, dbInstance);

  const [existing] = await dbInstance
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.organizationId, organizationId),
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new NotFoundError(`User is not a member of this team.`);
  }

  await dbInstance
    .delete(teamMembers)
    .where(
      and(
        eq(teamMembers.id, existing.id),
        eq(teamMembers.organizationId, organizationId)
      )
    );
}
