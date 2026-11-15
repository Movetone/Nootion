import type { FastifyPluginAsync } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { globalGroupMemberRoles, globalGroupMembers, globalGroupRoles, globalGroups } from "../db/schema.js";
import { notFound, parseBody, requireUser } from "../http.js";

const roleOrderInput = z.object({ roleIds: z.array(z.string().uuid()).max(100) });

export const userGroupRoutes: FastifyPluginAsync = async (app) => {
  app.patch<{ Params: { groupId: string } }>("/:groupId/roles/order", async (req) => {
    const user = requireUser(req);
    const input = parseBody(roleOrderInput, req.body);
    const group = app.db
      .select({ id: globalGroups.id })
      .from(globalGroupMembers)
      .innerJoin(globalGroups, eq(globalGroups.id, globalGroupMembers.groupId))
      .where(and(eq(globalGroups.id, req.params.groupId), eq(globalGroupMembers.userId, user.id)))
      .get();
    if (!group) throw notFound();
    const assigned = app.db
      .select({ id: globalGroupRoles.id })
      .from(globalGroupMemberRoles)
      .innerJoin(globalGroupRoles, eq(globalGroupRoles.id, globalGroupMemberRoles.roleId))
      .where(
        and(eq(globalGroupMemberRoles.groupId, group.id), eq(globalGroupMemberRoles.userId, user.id), inArray(globalGroupMemberRoles.roleId, input.roleIds)),
      )
      .all();
    if (assigned.length !== input.roleIds.length) throw notFound();
    for (const [position, roleId] of input.roleIds.entries()) {
      app.db
        .update(globalGroupMemberRoles)
        .set({ position })
        .where(and(eq(globalGroupMemberRoles.groupId, group.id), eq(globalGroupMemberRoles.userId, user.id), eq(globalGroupMemberRoles.roleId, roleId)))
        .run();
    }
    return { ok: true };
  });
};
