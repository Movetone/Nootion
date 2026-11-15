import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { and, eq } from "drizzle-orm";
import { toPublicUser } from "../users.js";
import { pages, users, workspaces } from "../db/schema.js";
import { notFound, requireUser } from "../http.js";
import { nextPosition, toSummary } from "../pages.js";

export const profileRoutes: FastifyPluginAsync = async (app) => {
  const db = app.db;

  function profilePage(user: typeof users.$inferSelect) {
    if (user.profilePageId) {
      const existing = db.select().from(pages).where(eq(pages.id, user.profilePageId)).get();
      if (existing) return existing;
    }

    const workspace = db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.createdBy, user.id), eq(workspaces.kind, "personal")))
      .get();
    if (!workspace) throw notFound();

    const page = db
      .insert(pages)
      .values({
        id: randomUUID(),
        workspaceId: workspace.id,
        parentId: null,
        title: user.name,
        icon: null,
        position: nextPosition(db, workspace.id, null),
        createdBy: user.id,
      })
      .returning()
      .get();
    db.update(users).set({ profilePageId: page.id }).where(eq(users.id, user.id)).run();
    return page;
  }

  app.get<{ Params: { id: string } }>("/:id", async (req) => {
    requireUser(req);
    const user = db
      .select()
      .from(users)
      .where(and(eq(users.id, req.params.id), eq(users.disabled, false)))
      .get();
    if (!user) throw notFound();
    const page = profilePage(user);
    return { profile: { user: toPublicUser(user), page: toSummary(page) } };
  });
};
