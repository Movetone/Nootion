import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { z } from "zod";
import { globalGroupAudit, globalGroupMemberRoles, globalGroupMembers, globalGroupRoles, globalGroups, users } from "../db/schema.js";
import { notFound, parseBody, requireAdmin, requireUser } from "../http.js";
import { requirePageRole } from "../permissions.js";

const groupInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(5000).optional(),
  icon: z.string().max(20).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  pageId: z.string().uuid().nullable().optional(),
});
const roleInput = z.object({ name: z.string().trim().min(1).max(100) });
const positionInput = z.object({ position: z.number().int().min(0) });
const memberInput = z.object({ userId: z.string().uuid(), roleIds: z.array(z.string().uuid()).max(100).default([]) });
const roleOrderInput = z.object({ roleIds: z.array(z.string().uuid()).max(100) });

export const groupRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", async (req) => {
    requireAdmin(req);
  });

  function groupOf(id: string) {
    const group = app.db.select().from(globalGroups).where(eq(globalGroups.id, id)).get();
    if (!group) throw notFound();
    return group;
  }

  function audit(
    actorId: string,
    action: string,
    values: { groupId?: string; targetUserId?: string; roleId?: string; details?: Record<string, unknown> } = {},
  ) {
    app.db
      .insert(globalGroupAudit)
      .values({ id: randomUUID(), actorId, action, ...values })
      .run();
  }

  function groupInfo(group: typeof globalGroups.$inferSelect) {
    const roles = app.db
      .select({ id: globalGroupRoles.id, name: globalGroupRoles.name, position: globalGroupRoles.position })
      .from(globalGroupRoles)
      .where(eq(globalGroupRoles.groupId, group.id))
      .orderBy(asc(globalGroupRoles.position), asc(globalGroupRoles.createdAt))
      .all();
    const members = app.db
      .select({ userId: globalGroupMembers.userId, name: users.name, email: users.email, position: globalGroupMembers.position })
      .from(globalGroupMembers)
      .innerJoin(users, eq(users.id, globalGroupMembers.userId))
      .where(eq(globalGroupMembers.groupId, group.id))
      .orderBy(asc(globalGroupMembers.position), asc(users.name))
      .all()
      .map((member) => ({
        ...member,
        roles: app.db
          .select({ id: globalGroupRoles.id, name: globalGroupRoles.name })
          .from(globalGroupMemberRoles)
          .innerJoin(globalGroupRoles, eq(globalGroupRoles.id, globalGroupMemberRoles.roleId))
          .where(and(eq(globalGroupMemberRoles.groupId, group.id), eq(globalGroupMemberRoles.userId, member.userId)))
          .orderBy(asc(globalGroupRoles.position), asc(globalGroupRoles.createdAt))
          .all(),
      }));
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
      color: group.color,
      pageId: group.pageId,
      position: group.position,
      roles,
      members,
    };
  }

  app.get("/", async () => ({
    groups: app.db.select().from(globalGroups).orderBy(asc(globalGroups.position), asc(globalGroups.createdAt)).all().map(groupInfo),
  }));

  app.post("/", async (req) => {
    const admin = requireAdmin(req);
    const input = parseBody(groupInput, req.body);
    if (input.pageId) requirePageRole(app.db, admin.id, input.pageId, "viewer");
    const position =
      (app.db
        .select({ max: max(globalGroups.position) })
        .from(globalGroups)
        .get()?.max ?? -1) + 1;
    const group = app.db
      .insert(globalGroups)
      .values({ id: randomUUID(), ...input, description: input.description ?? "", position })
      .returning()
      .get();
    audit(admin.id, "group_created", { groupId: group.id, details: { name: group.name } });
    return { group: groupInfo(group) };
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const input = parseBody(groupInput.partial(), req.body);
    if (input.pageId) requirePageRole(app.db, admin.id, input.pageId, "viewer");
    const updated = app.db.update(globalGroups).set(input).where(eq(globalGroups.id, group.id)).returning().get();
    audit(admin.id, "group_updated", { groupId: group.id, details: input });
    return { group: groupInfo(updated) };
  });

  app.patch<{ Params: { id: string } }>("/:id/position", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const input = parseBody(positionInput, req.body);
    const updated = app.db.update(globalGroups).set({ position: input.position }).where(eq(globalGroups.id, group.id)).returning().get();
    audit(admin.id, "group_reordered", { groupId: group.id, details: input });
    return { group: groupInfo(updated) };
  });

  app.post<{ Params: { id: string } }>("/:id/archive", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const updated = app.db.update(globalGroups).set({ archivedAt: new Date() }).where(eq(globalGroups.id, group.id)).returning().get();
    audit(admin.id, "group_archived", { groupId: group.id });
    return { group: groupInfo(updated) };
  });

  app.post<{ Params: { id: string } }>("/:id/restore", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const updated = app.db.update(globalGroups).set({ archivedAt: null }).where(eq(globalGroups.id, group.id)).returning().get();
    audit(admin.id, "group_restored", { groupId: group.id });
    return { group: groupInfo(updated) };
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    audit(admin.id, "group_deleted", { groupId: group.id, details: { name: group.name } });
    app.db.delete(globalGroups).where(eq(globalGroups.id, group.id)).run();
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/:id/roles", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const input = parseBody(roleInput, req.body);
    const position =
      (app.db
        .select({ max: max(globalGroupRoles.position) })
        .from(globalGroupRoles)
        .where(eq(globalGroupRoles.groupId, group.id))
        .get()?.max ?? -1) + 1;
    const role = app.db.insert(globalGroupRoles).values({ id: randomUUID(), groupId: group.id, name: input.name, position }).returning().get();
    audit(admin.id, "role_created", { groupId: group.id, roleId: role.id, details: { name: role.name } });
    return { role };
  });

  app.patch<{ Params: { id: string; roleId: string } }>("/:id/roles/:roleId", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const role = app.db
      .select()
      .from(globalGroupRoles)
      .where(and(eq(globalGroupRoles.id, req.params.roleId), eq(globalGroupRoles.groupId, group.id)))
      .get();
    if (!role) throw notFound();
    const input = parseBody(roleInput.partial().merge(positionInput.partial()), req.body);
    const updated = app.db.update(globalGroupRoles).set(input).where(eq(globalGroupRoles.id, role.id)).returning().get();
    audit(admin.id, "role_updated", { groupId: group.id, roleId: role.id, details: input });
    return { role: updated };
  });

  app.delete<{ Params: { id: string; roleId: string } }>("/:id/roles/:roleId", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const role = app.db
      .select()
      .from(globalGroupRoles)
      .where(and(eq(globalGroupRoles.id, req.params.roleId), eq(globalGroupRoles.groupId, group.id)))
      .get();
    if (!role) throw notFound();
    audit(admin.id, "role_deleted", { groupId: group.id, roleId: role.id, details: { name: role.name } });
    app.db.delete(globalGroupRoles).where(eq(globalGroupRoles.id, role.id)).run();
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/:id/members", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    const input = parseBody(memberInput, req.body);
    const target = app.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.userId), eq(users.disabled, false)))
      .get();
    if (!target) throw notFound();
    const roles = input.roleIds.length
      ? app.db
          .select({ id: globalGroupRoles.id })
          .from(globalGroupRoles)
          .where(and(eq(globalGroupRoles.groupId, group.id), inArray(globalGroupRoles.id, input.roleIds)))
          .all()
      : [];
    if (roles.length !== input.roleIds.length) throw notFound();
    const position =
      (app.db
        .select({ max: max(globalGroupMembers.position) })
        .from(globalGroupMembers)
        .where(eq(globalGroupMembers.groupId, group.id))
        .get()?.max ?? -1) + 1;
    const existingMember = app.db
      .select()
      .from(globalGroupMembers)
      .where(and(eq(globalGroupMembers.groupId, group.id), eq(globalGroupMembers.userId, target.id)))
      .get();
    if (!existingMember) {
      app.db.insert(globalGroupMembers).values({ groupId: group.id, userId: target.id, position }).run();
    }
    app.db
      .delete(globalGroupMemberRoles)
      .where(and(eq(globalGroupMemberRoles.groupId, group.id), eq(globalGroupMemberRoles.userId, target.id)))
      .run();
    if (input.roleIds.length)
      app.db
        .insert(globalGroupMemberRoles)
        .values(input.roleIds.map((roleId, position) => ({ groupId: group.id, userId: target.id, roleId, position })))
        .run();
    audit(admin.id, "member_updated", { groupId: group.id, targetUserId: target.id, details: { roleIds: input.roleIds } });
    return { member: groupInfo(group).members.find((member) => member.userId === target.id) };
  });

  app.delete<{ Params: { id: string; userId: string } }>("/:id/members/:userId", async (req) => {
    const admin = requireAdmin(req);
    const group = groupOf(req.params.id);
    app.db
      .delete(globalGroupMemberRoles)
      .where(and(eq(globalGroupMemberRoles.groupId, group.id), eq(globalGroupMemberRoles.userId, req.params.userId)))
      .run();
    app.db
      .delete(globalGroupMembers)
      .where(and(eq(globalGroupMembers.groupId, group.id), eq(globalGroupMembers.userId, req.params.userId)))
      .run();
    audit(admin.id, "member_removed", { groupId: group.id, targetUserId: req.params.userId });
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/:id/audit", async (req) => {
    groupOf(req.params.id);
    return { audit: app.db.select().from(globalGroupAudit).where(eq(globalGroupAudit.groupId, req.params.id)).orderBy(asc(globalGroupAudit.createdAt)).all() };
  });
};
