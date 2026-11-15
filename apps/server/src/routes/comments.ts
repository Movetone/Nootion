import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  atLeast,
  commentBodyInput,
  commentMentions,
  commentPlainText,
  createThreadInput,
  iconText,
  resolveThreadInput,
  t,
  tIn,
  type CommentNotification,
  type CommentThread,
  type Locale,
} from "@nootion/shared";
import { commentAttachments, commentNotifications, comments, commentThreads, attachments, pageMentions, pages, users } from "../db/schema.js";
import { attachmentPath, uploadsDir } from "../attachments.js";
import { listPageMentions } from "../mentions.js";
import { HttpError, notFound, parseBody, requireUser } from "../http.js";
import { getPageRole, requirePageRole } from "../permissions.js";
import { avatarUrl } from "../users.js";
import type { Db } from "../db/index.js";

const EXCERPT = 200;

/** Comment threads on pages, their replies, and the notifications they send to the people concerned. */
export const commentRoutes: FastifyPluginAsync = async (app) => {
  const { db } = app;

  /** Reading needs the page; writing needs at least the "commenter" role. */
  function pageAccess(userId: string, pageId: string, write: boolean) {
    const access = requirePageRole(db, userId, pageId, "viewer");
    if (access.page.kind === "database") throw new HttpError(400, "not_a_page", t("error.notAPage"));
    if (write && !atLeast(access.role, "commenter")) throw new HttpError(403, "forbidden", t("error.cannotComment"));
    return access;
  }

  function threadOf(threadId: string) {
    const thread = db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).get();
    if (!thread) throw notFound();
    return thread;
  }

  async function multipartComment(req: FastifyRequest, pageId: string, userId: string, threadId: string | null) {
    const maxBytes = app.config.maxUploadMb * 1024 * 1024;
    const temp: { id: string; filename: string; mimeType: string; size: number; tmp: string; dest: string }[] = [];
    let payload: Record<string, unknown> | null = null;
    try {
      for await (const part of req.parts({ limits: { fileSize: maxBytes } })) {
        if (part.type === "field") {
          if (part.fieldname === "payload") payload = JSON.parse(String(part.value)) as Record<string, unknown>;
          continue;
        }
        const id = randomUUID();
        fs.mkdirSync(uploadsDir(app.config.dataDir), { recursive: true });
        const dest = attachmentPath(app.config.dataDir, id);
        const tmp = `${dest}.part`;
        await pipeline(part.file, fs.createWriteStream(tmp));
        if (part.file.truncated) throw new HttpError(413, "too_large", t("error.fileTooLarge", { max: app.config.maxUploadMb }));
        const size = fs.statSync(tmp).size;
        temp.push({
          id,
          filename: (part.filename || "file").replace(/[\\/\r\n]/g, "_").slice(0, 255),
          mimeType: part.mimetype || "application/octet-stream",
          size,
          tmp,
          dest,
        });
      }
      if (!payload) throw new HttpError(400, "bad_comment", "Invalid comment");
      const input = threadId ? { body: String(payload.body ?? "") } : createThreadInput.parse(payload);
      if (threadId) {
        const thread = threadOf(threadId);
        if (thread.pageId !== pageId) throw notFound();
      }
      const thread = threadId
        ? threadOf(threadId)
        : (() => {
            const id = randomUUID();
            const anchor = input as z.infer<typeof createThreadInput>;
            db.insert(commentThreads)
              .values({
                id,
                pageId,
                anchorStart: anchor.anchor?.start ?? null,
                anchorEnd: anchor.anchor?.end ?? null,
                quote: anchor.anchor ? anchor.quote : "",
              })
              .run();
            return threadOf(id);
          })();
      if (thread.resolvedAt) db.update(commentThreads).set({ resolvedAt: null, resolvedBy: null }).where(eq(commentThreads.id, thread.id)).run();
      const commentId = await addComment(thread.id, userId, input.body);
      db.transaction((tx) => {
        for (const [position, file] of temp.entries()) {
          fs.renameSync(file.tmp, file.dest);
          tx.insert(attachments).values({ id: file.id, pageId, filename: file.filename, mimeType: file.mimeType, size: file.size, createdBy: userId }).run();
          tx.insert(commentAttachments).values({ commentId, attachmentId: file.id, position }).run();
        }
      });
      app.extractor.wake();
      return { thread: listThreads(db, pageId, thread.id)[0] };
    } catch (error) {
      for (const file of temp) {
        fs.rmSync(file.tmp, { force: true });
        fs.rmSync(file.dest, { force: true });
      }
      throw error;
    }
  }

  app.get<{ Params: { pageId: string } }>("/pages/:pageId/comments", async (req) => {
    const user = requireUser(req);
    pageAccess(user.id, req.params.pageId, false);
    return { threads: listThreads(db, req.params.pageId) };
  });

  app.post<{ Params: { pageId: string } }>("/pages/:pageId/comments", async (req) => {
    const user = requireUser(req);
    const { page } = pageAccess(user.id, req.params.pageId, true);
    const input = parseBody(createThreadInput, req.body);
    const id = randomUUID();
    db.insert(commentThreads)
      .values({ id, pageId: page.id, anchorStart: input.anchor?.start ?? null, anchorEnd: input.anchor?.end ?? null, quote: input.anchor ? input.quote : "" })
      .run();
    await addComment(id, user.id, input.body);
    return { thread: listThreads(db, page.id, id)[0] };
  });

  app.post<{ Params: { pageId: string } }>("/pages/:pageId/comments/multipart", async (req) => {
    const user = requireUser(req);
    pageAccess(user.id, req.params.pageId, true);
    return multipartComment(req, req.params.pageId, user.id, null);
  });

  app.post<{ Params: { threadId: string } }>("/comments/threads/:threadId/replies/multipart", async (req) => {
    const user = requireUser(req);
    const thread = threadOf(req.params.threadId);
    pageAccess(user.id, thread.pageId, true);
    return multipartComment(req, thread.pageId, user.id, thread.id);
  });

  app.post<{ Params: { threadId: string } }>("/comments/threads/:threadId/replies", async (req) => {
    const user = requireUser(req);
    const thread = threadOf(req.params.threadId);
    pageAccess(user.id, thread.pageId, true);
    const { body } = parseBody(commentBodyInput, req.body);
    // Answering a resolved thread opens it again.
    if (thread.resolvedAt) db.update(commentThreads).set({ resolvedAt: null, resolvedBy: null }).where(eq(commentThreads.id, thread.id)).run();
    await addComment(thread.id, user.id, body);
    return { thread: listThreads(db, thread.pageId, thread.id)[0] };
  });

  app.post<{ Params: { threadId: string } }>("/comments/threads/:threadId/resolve", async (req) => {
    const user = requireUser(req);
    const thread = threadOf(req.params.threadId);
    pageAccess(user.id, thread.pageId, true);
    const { resolved } = parseBody(resolveThreadInput, req.body);
    db.update(commentThreads)
      .set(resolved ? { resolvedAt: new Date(), resolvedBy: user.id } : { resolvedAt: null, resolvedBy: null })
      .where(eq(commentThreads.id, thread.id))
      .run();
    return { thread: listThreads(db, thread.pageId, thread.id)[0] };
  });

  /** Only its author changes or deletes a comment. */
  function ownComment(userId: string, commentId: string) {
    const comment = db.select().from(comments).where(eq(comments.id, commentId)).get();
    if (!comment) throw notFound();
    const thread = threadOf(comment.threadId);
    pageAccess(userId, thread.pageId, true);
    if (comment.authorId !== userId) throw new HttpError(403, "forbidden", t("error.notYourComment"));
    return { comment, thread };
  }

  function removeCommentAttachments(commentId: string) {
    const files = db
      .select({ id: attachments.id })
      .from(commentAttachments)
      .innerJoin(attachments, eq(attachments.id, commentAttachments.attachmentId))
      .where(eq(commentAttachments.commentId, commentId))
      .all();
    db.delete(attachments)
      .where(
        inArray(
          attachments.id,
          files.map((file) => file.id),
        ),
      )
      .run();
    for (const file of files) fs.rmSync(attachmentPath(app.config.dataDir, file.id), { force: true });
  }

  app.patch<{ Params: { id: string } }>("/comments/:id", async (req) => {
    const user = requireUser(req);
    const { comment, thread } = ownComment(user.id, req.params.id);
    const { body } = parseBody(commentBodyInput, req.body);
    db.update(comments).set({ body, editedAt: new Date() }).where(eq(comments.id, comment.id)).run();
    // Only the people newly mentioned hear about it.
    await notify(comment.id, user.id, body, thread.id, { reply: false, skip: commentMentions(comment.body) });
    return { thread: listThreads(db, thread.pageId, thread.id)[0] };
  });

  // The last comment of a thread takes the thread with it.
  app.delete<{ Params: { id: string } }>("/comments/:id", async (req) => {
    const user = requireUser(req);
    const { comment, thread } = ownComment(user.id, req.params.id);
    removeCommentAttachments(comment.id);
    db.delete(comments).where(eq(comments.id, comment.id)).run();
    const left = db.select({ id: comments.id }).from(comments).where(eq(comments.threadId, thread.id)).get();
    if (!left) db.delete(commentThreads).where(eq(commentThreads.id, thread.id)).run();
    return { thread: left ? listThreads(db, thread.pageId, thread.id)[0] : null };
  });

  app.get("/comments/notifications", async (req) => {
    const user = requireUser(req);
    // Mentions in comments and in pages, the latest first.
    const all = [...listNotifications(db, user.id), ...listPageMentions(db, user.id, user.locale as Locale)];
    return { notifications: all.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50) };
  });

  app.post("/comments/notifications/read", async (req) => {
    const user = requireUser(req);
    const { ids } = parseBody(z.object({ ids: z.array(z.string()).max(500).optional() }), req.body ?? {});
    db.update(commentNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(commentNotifications.userId, user.id), isNull(commentNotifications.readAt), ids ? inArray(commentNotifications.id, ids) : undefined))
      .run();
    db.update(pageMentions)
      .set({ readAt: new Date() })
      .where(and(eq(pageMentions.userId, user.id), isNull(pageMentions.readAt), ids ? inArray(pageMentions.id, ids) : undefined))
      .run();
    return { ok: true };
  });

  async function addComment(threadId: string, authorId: string, body: string) {
    const reply = !!db.select({ id: comments.id }).from(comments).where(eq(comments.threadId, threadId)).get();
    const id = randomUUID();
    db.insert(comments).values({ id, threadId, authorId, body }).run();
    await notify(id, authorId, body, threadId, { reply, skip: [] });
    return id;
  }

  /**
   * Tells the people mentioned (and not already told for this comment), and on a reply, the others taking part in the
   * thread. Only people who can read the page, never the author.
   */
  async function notify(commentId: string, authorId: string, body: string, threadId: string, opts: { reply: boolean; skip: string[] }) {
    const thread = threadOf(threadId);
    const targets = new Map<string, "mention" | "reply">();
    for (const id of commentMentions(body)) if (!opts.skip.includes(id)) targets.set(id, "mention");
    if (opts.reply) {
      for (const c of db.select({ authorId: comments.authorId }).from(comments).where(eq(comments.threadId, threadId)).all())
        if (!targets.has(c.authorId)) targets.set(c.authorId, "reply");
    }
    targets.delete(authorId);
    if (!targets.size) return;

    const page = db.select({ title: pages.title, icon: pages.icon }).from(pages).where(eq(pages.id, thread.pageId)).get()!;
    const names = userNames(db);
    const author = names.get(authorId)?.name ?? "?";
    const text = commentPlainText(body, (id) => names.get(id)?.name);
    for (const [userId, kind] of targets) {
      const target = names.get(userId);
      if (!target || !atLeast(getPageRole(db, userId, thread.pageId), "viewer")) continue;
      const inserted = db
        .insert(commentNotifications)
        .values({ id: randomUUID(), userId, commentId, kind })
        .onConflictDoNothing()
        .returning({ id: commentNotifications.id })
        .get();
      if (!inserted) continue;
      const locale = target.locale as Locale;
      await app.notifier.push(
        userId,
        {
          title: tIn(locale, kind === "mention" ? "comments.pushMention" : "comments.pushReply", {
            name: author,
            page: `${iconText(page.icon)}${page.title || tIn(locale, "common.untitled")}`,
          }),
          body: text.slice(0, EXCERPT),
          url: `/page/${thread.pageId}?comment=${threadId}`,
          tag: commentId,
        },
        kind === "mention" ? "mentions" : "replies",
      );
    }
  }
};

function userNames(db: Db) {
  return new Map(
    db
      .select({ id: users.id, name: users.name, avatar: users.avatar, locale: users.locale })
      .from(users)
      .all()
      .map((u) => [u.id, u]),
  );
}

/** A page's threads (or one of them), the open ones first, each with its comments in order. */
export function listThreads(db: Db, pageId: string, onlyThread?: string): CommentThread[] {
  const threads = db
    .select()
    .from(commentThreads)
    .where(onlyThread ? and(eq(commentThreads.pageId, pageId), eq(commentThreads.id, onlyThread)) : eq(commentThreads.pageId, pageId))
    .orderBy(asc(commentThreads.createdAt))
    .all();
  if (!threads.length) return [];
  const list = db
    .select()
    .from(comments)
    .where(
      inArray(
        comments.threadId,
        threads.map((th) => th.id),
      ),
    )
    .orderBy(asc(comments.createdAt))
    .all();
  const attachmentRows = list.length
    ? db
        .select({
          commentId: commentAttachments.commentId,
          id: attachments.id,
          filename: attachments.filename,
          mimeType: attachments.mimeType,
          size: attachments.size,
          position: commentAttachments.position,
        })
        .from(commentAttachments)
        .innerJoin(attachments, eq(attachments.id, commentAttachments.attachmentId))
        .where(
          inArray(
            commentAttachments.commentId,
            list.map((comment) => comment.id),
          ),
        )
        .orderBy(asc(commentAttachments.position))
        .all()
    : [];
  const names = userNames(db);
  return threads
    .map((th) => ({
      id: th.id,
      pageId: th.pageId,
      anchor: th.anchorStart && th.anchorEnd ? { start: th.anchorStart, end: th.anchorEnd } : null,
      quote: th.quote,
      resolvedAt: th.resolvedAt?.toISOString() ?? null,
      resolvedByName: th.resolvedBy ? (names.get(th.resolvedBy)?.name ?? null) : null,
      comments: list
        .filter((c) => c.threadId === th.id)
        .map((c) => {
          const author = names.get(c.authorId);
          return {
            id: c.id,
            authorId: c.authorId,
            authorName: author?.name ?? "?",
            authorAvatarUrl: author ? avatarUrl(author) : null,
            body: c.body,
            createdAt: c.createdAt.toISOString(),
            editedAt: c.editedAt?.toISOString() ?? null,
            attachments: attachmentRows
              .filter((file) => file.commentId === c.id)
              .map((file) => ({ id: file.id, filename: file.filename, mimeType: file.mimeType, size: file.size, url: `/api/attachments/${file.id}` })),
          };
        }),
    }))
    .sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt));
}

/** The user's latest mentions and replies, on pages they can still read. */
export function listNotifications(db: Db, userId: string): CommentNotification[] {
  const rows = db
    .select({
      n: commentNotifications,
      body: comments.body,
      actorId: comments.authorId,
      threadId: comments.threadId,
      pageId: commentThreads.pageId,
      title: pages.title,
      icon: pages.icon,
    })
    .from(commentNotifications)
    .innerJoin(comments, eq(comments.id, commentNotifications.commentId))
    .innerJoin(commentThreads, eq(commentThreads.id, comments.threadId))
    .innerJoin(pages, eq(pages.id, commentThreads.pageId))
    .where(eq(commentNotifications.userId, userId))
    .orderBy(desc(commentNotifications.createdAt))
    .limit(50)
    .all();
  const names = userNames(db);
  return rows
    .filter((r) => atLeast(getPageRole(db, userId, r.pageId), "viewer"))
    .map((r) => ({
      id: r.n.id,
      kind: r.n.kind,
      pageId: r.pageId,
      pageTitle: r.title,
      pageIcon: r.icon,
      threadId: r.threadId,
      actorName: names.get(r.actorId)?.name ?? "?",
      excerpt: commentPlainText(r.body, (id) => names.get(id)?.name).slice(0, EXCERPT),
      createdAt: r.n.createdAt.toISOString(),
      read: !!r.n.readAt,
    }));
}
