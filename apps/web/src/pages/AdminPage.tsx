import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, DatabaseBackup, KeyRound, Mail, Puzzle, ShieldCheck, Trash2, UserPlus, Users, type LucideIcon } from "lucide-react";
import { intlLocale, t, type InvitationInfo, type PublicUser, type UserRole } from "@nootion/shared";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import { Button, ErrorText, Field, Rich } from "../components/ui";
import { PluginsAdmin } from "./PluginsAdmin";
import { BackupsAdmin } from "./BackupsAdmin";
import { MailAdmin } from "./MailAdmin";
import { SsoAdmin } from "./SsoAdmin";
import { SecurityAdmin } from "./SecurityAdmin";
import { copyText } from "../lib/browser";
import { UpdateBanner, VersionLine } from "../components/UpdateNotice";

/** The page's sections, in order: the menu on the left and the cards share these ids. */
const SECTIONS: { id: string; icon: LucideIcon; label: () => string }[] = [
  { id: "users", icon: Users, label: () => t("admin.nav.users") },
  { id: "groups", icon: Users, label: () => "Groups" },
  { id: "invite", icon: UserPlus, label: () => t("admin.nav.invite") },
  { id: "backups", icon: DatabaseBackup, label: () => t("admin.nav.backups") },
  { id: "mail", icon: Mail, label: () => t("admin.nav.mail") },
  { id: "sso", icon: KeyRound, label: () => t("admin.nav.sso") },
  { id: "security", icon: ShieldCheck, label: () => t("admin.nav.security") },
  { id: "plugins", icon: Puzzle, label: () => t("admin.nav.plugins") },
];

/** One section of the page, drawn as a card so that sections don't run into each other. */
function AdminCard({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div
      id={`admin-${id}`}
      data-admin-section={id}
      className="scroll-mt-28 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6 lg:scroll-mt-16 dark:border-neutral-800 dark:bg-neutral-900/40"
    >
      {children}
    </div>
  );
}

/** Follows which section is on screen while the page scrolls. */
function useCurrentSection(content: React.RefObject<HTMLDivElement | null>) {
  const [current, setCurrent] = useState(SECTIONS[0].id);
  useEffect(() => {
    const scroller = content.current?.closest("main") ?? null;
    const target: HTMLElement | Window = scroller ?? window;
    const update = () => {
      const cards = [...(content.current?.querySelectorAll<HTMLElement>("[data-admin-section]") ?? [])];
      if (!cards.length) return;
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      const atBottom = scroller
        ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4
        : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let id = cards[0].dataset.adminSection!;
      for (const c of cards) if (c.getBoundingClientRect().top - top <= 140) id = c.dataset.adminSection!;
      setCurrent(atBottom ? cards[cards.length - 1].dataset.adminSection! : id);
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [content]);
  return [current, setCurrent] as const;
}

function SectionNav({ current, onPick }: { current: string; onPick: (id: string) => void }) {
  const tabs = useRef<HTMLElement>(null);
  // Keeps the current tab visible in the row of tabs (without scrolling the page).
  useEffect(() => {
    const bar = tabs.current;
    const tab = bar?.querySelector<HTMLElement>(`[href="#${current}"]`);
    if (!bar || !tab || !bar.offsetParent) return;
    const left = tab.offsetLeft - bar.offsetLeft;
    if (left < bar.scrollLeft || left + tab.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: left - 20, behavior: "smooth" });
  }, [current]);
  const go = (id: string) => {
    onPick(id);
    document.getElementById(`admin-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  return (
    <>
      {/* Wide screens: a menu that stays on the left. */}
      <nav aria-label={t("admin.nav.label")} className="sticky top-16 hidden self-start lg:block">
        <ul className="space-y-0.5">
          {SECTIONS.map(({ id, icon: Icon, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={current === id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(id);
                }}
                className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  current === id
                    ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
                }`}
              >
                <Icon size={16} className="shrink-0" aria-hidden />
                {label()}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* Narrow screens: a row of tabs that stays at the top. */}
      <nav
        ref={tabs}
        aria-label={t("admin.nav.label")}
        className="sticky top-[49px] z-10 -mx-5 mb-4 overflow-x-auto border-b border-neutral-200 bg-white/90 px-5 py-2 backdrop-blur sm:-mx-8 sm:px-8 lg:hidden dark:border-neutral-800 dark:bg-neutral-950/90"
      >
        <ul className="flex w-max gap-1.5">
          {SECTIONS.map(({ id, icon: Icon, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={current === id ? "true" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(id);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap ${
                  current === id
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                    : "border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                }`}
              >
                <Icon size={14} aria-hidden />
                {label()}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

type AdminGroup = {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  roles: { id: string; name: string }[];
  members: { userId: string; name: string; email: string; roles: { id: string; name: string }[] }[];
};

const dateFmt = () => new Intl.DateTimeFormat(intlLocale(), { dateStyle: "medium" });

export function AdminPage() {
  const { user: me } = useSession();
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api<{ users: PublicUser[] }>("/admin/users"),
  });
  const invitations = useQuery({
    queryKey: ["admin", "invitations"],
    queryFn: () => api<{ invitations: InvitationInfo[] }>("/admin/invitations"),
  });
  const groups = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: () => api<{ groups: AdminGroup[] }>("/admin/groups"),
  });
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [newRole, setNewRole] = useState<Record<string, string>>({});
  const [memberChoice, setMemberChoice] = useState<Record<string, string>>({});
  const [roleChoice, setRoleChoice] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("member");
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useCurrentSection(content);
  // A link to a section (/admin#sso) opens on it.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (SECTIONS.some((x) => x.id === id)) document.getElementById(`admin-${id}`)?.scrollIntoView({ block: "start" });
  }, []);

  const createGroup = useMutation({
    mutationFn: () => api("/admin/groups", { method: "POST", body: { name: groupName, description: groupDescription } }),
    onSuccess: () => {
      setGroupName("");
      setGroupDescription("");
      qc.invalidateQueries({ queryKey: ["admin", "groups"] });
    },
  });
  const addRole = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) => api(`/admin/groups/${groupId}/roles`, { method: "POST", body: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });
  const updateMember = useMutation({
    mutationFn: ({ groupId, userId, roleIds }: { groupId: string; userId: string; roleIds: string[] }) =>
      api(`/admin/groups/${groupId}/members`, { method: "POST", body: { userId, roleIds } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "groups"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  const removeMember = useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) => api(`/admin/groups/${groupId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });
  const deleteGroup = useMutation({
    mutationFn: (groupId: string) => api(`/admin/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "groups"] }),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: UserRole; disabled?: boolean } }) => api(`/admin/users/${id}`, { method: "PATCH", body: patch }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const resetTwoFactor = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}/2fa`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
  const createInvite = useMutation({
    mutationFn: () =>
      api<{ url: string; emailed: boolean }>("/admin/invitations", {
        method: "POST",
        body: { email: inviteEmail || undefined, role: inviteRole },
      }),
    onSuccess: (data) => {
      setLastLink(data.url);
      setEmailedTo(data.emailed ? inviteEmail : null);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "invitations"] });
    },
  });
  const revokeInvite = useMutation({
    mutationFn: (id: string) => api(`/admin/invitations/${id}`, { method: "DELETE" }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "invitations"] }),
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <h1 className="mb-6 text-2xl font-bold">{t("admin.title")}</h1>
      <UpdateBanner />
      <div className="lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <SectionNav current={current} onPick={setCurrent} />
        <div ref={content} className="space-y-6">
          <AdminCard id="users">
            <section>
              <h2 className="mb-3 text-lg font-semibold">{t("admin.users")}</h2>
              <ErrorText error={updateUser.error} />
              <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-neutral-500 dark:bg-neutral-950">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("auth.name")}</th>
                      <th className="px-3 py-2 font-medium">{t("auth.email")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.role")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.users.map((u) => (
                      <tr key={u.id} className="border-t border-neutral-200 dark:border-neutral-800">
                        <td className="px-3 py-2">
                          {u.name}
                          {u.twoFactor && (
                            <span
                              className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              title={t("twoFactor.title")}
                            >
                              {t("twoFactor.badge")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-neutral-500">{u.email}</td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded border border-neutral-300 bg-transparent px-2 py-1 dark:border-neutral-700"
                            value={u.role}
                            onChange={(e) =>
                              updateUser.mutate({
                                id: u.id,
                                patch: { role: e.target.value as UserRole },
                              })
                            }
                          >
                            <option value="member">{t("admin.member")}</option>
                            <option value="admin">{t("admin.admin")}</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {u.id === me?.id ? (
                            <span className="text-neutral-400">{t("common.you")}</span>
                          ) : (
                            <Button
                              variant={u.disabled ? "ghost" : "danger"}
                              onClick={() =>
                                updateUser.mutate({
                                  id: u.id,
                                  patch: { disabled: !u.disabled },
                                })
                              }
                            >
                              {u.disabled ? t("admin.enable") : t("admin.disable")}
                            </Button>
                          )}
                          {u.twoFactor && u.id !== me?.id && (
                            <Button
                              variant="ghost"
                              className="ml-2"
                              onClick={() => {
                                if (
                                  confirm(
                                    t("twoFactor.adminResetConfirm", {
                                      name: u.name,
                                    }),
                                  )
                                )
                                  resetTwoFactor.mutate(u.id);
                              }}
                            >
                              {t("twoFactor.adminReset")}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </AdminCard>

          <AdminCard id="groups">
            <section>
              <h2 className="mb-1 text-lg font-semibold">Groups</h2>
              <p className="mb-4 text-sm text-neutral-500">Manage global groups, roles, and user memberships. Group membership does not grant page access.</p>
              <form
                className="mb-6 flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (groupName.trim()) createGroup.mutate();
                }}
              >
                <div className="min-w-48 flex-1">
                  <Field label="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                </div>
                <div className="min-w-64 flex-1">
                  <Field label="Description" value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} />
                </div>
                <Button type="submit" disabled={createGroup.isPending}>
                  Create group
                </Button>
              </form>
              <div className="space-y-4">
                {groups.data?.groups.map((group) => (
                  <div key={group.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">
                          {group.icon ? `${group.icon} ` : ""}
                          {group.name}
                        </h3>
                        <p className="text-sm text-neutral-500">{group.description || "No description"}</p>
                      </div>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (confirm(`Delete ${group.name}?`)) deleteGroup.mutate(group.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Roles</h4>
                        <div className="mb-2 flex flex-wrap gap-2">
                          {group.roles.map((role) => (
                            <span key={role.id} className="rounded-full bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
                              {role.name}
                            </span>
                          ))}
                        </div>
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const name = newRole[group.id]?.trim();
                            if (name) {
                              addRole.mutate({ groupId: group.id, name });
                              setNewRole((state) => ({ ...state, [group.id]: "" }));
                            }
                          }}
                        >
                          <input
                            className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                            placeholder="New role"
                            value={newRole[group.id] ?? ""}
                            onChange={(event) => setNewRole((state) => ({ ...state, [group.id]: event.target.value }))}
                          />
                          <Button type="submit">Add</Button>
                        </form>
                      </div>
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Members</h4>
                        <ul className="mb-2 space-y-1 text-sm">
                          {group.members.map((member) => (
                            <li key={member.userId} className="flex items-center justify-between gap-2">
                              <span>
                                {member.name}
                                {member.roles.length ? ` · ${member.roles.map((role) => role.name).join(", ")}` : ""}
                              </span>
                              <Button variant="ghost" onClick={() => removeMember.mutate({ groupId: group.id, userId: member.userId })}>
                                <Trash2 size={14} />
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <form
                          className="flex flex-wrap gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const userId = memberChoice[group.id];
                            if (userId) updateMember.mutate({ groupId: group.id, userId, roleIds: roleChoice[group.id] ? [roleChoice[group.id]] : [] });
                          }}
                        >
                          <select
                            className="min-w-0 flex-1 rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                            value={memberChoice[group.id] ?? ""}
                            onChange={(event) => setMemberChoice((state) => ({ ...state, [group.id]: event.target.value }))}
                          >
                            <option value="">Choose user</option>
                            {users.data?.users
                              .filter((user) => !group.members.some((member) => member.userId === user.id))
                              .map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name}
                                </option>
                              ))}
                          </select>
                          <select
                            className="min-w-0 rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                            value={roleChoice[group.id] ?? ""}
                            onChange={(event) => setRoleChoice((state) => ({ ...state, [group.id]: event.target.value }))}
                          >
                            <option value="">No role</option>
                            {group.roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                          <Button type="submit">Add member</Button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </AdminCard>

          <AdminCard id="invite">
            <section>
              <h2 className="mb-1 text-lg font-semibold">{t("admin.invite")}</h2>
              <p className="mb-3 text-sm text-neutral-500">{t("admin.inviteHelp")}</p>
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  createInvite.mutate();
                }}
              >
                <div className="min-w-64 flex-1">
                  <Field label={t("admin.inviteEmail")} type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <select
                  className="rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                >
                  <option value="member">{t("admin.member")}</option>
                  <option value="admin">{t("admin.admin")}</option>
                </select>
                <Button type="submit" disabled={createInvite.isPending}>
                  {t("admin.createLink")}
                </Button>
              </form>
              <ErrorText error={createInvite.error} />
              {lastLink && emailedTo && <p className="mt-3 text-sm text-green-700 dark:text-green-400">✓ {t("admin.inviteEmailed", { email: emailedTo })}</p>}
              {lastLink && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm dark:bg-green-950">
                  <code className="flex-1 break-all">{lastLink}</code>
                  <Button variant="ghost" onClick={() => void copyText(lastLink)} title={t("common.copy")}>
                    <Copy size={16} />
                  </Button>
                </div>
              )}
              {!!invitations.data?.invitations.length && (
                <ul className="mt-4 divide-y divide-neutral-200 rounded-lg border border-neutral-200 text-sm dark:divide-neutral-800 dark:border-neutral-800">
                  {invitations.data.invitations.map((i) => (
                    <li key={i.id} className="flex items-center justify-between px-3 py-2">
                      <span>
                        {i.email ?? t("admin.openLink")} · {i.role === "admin" ? t("admin.admin") : t("admin.member")} ·{" "}
                        {t("admin.expiresOn", {
                          date: dateFmt().format(new Date(i.expiresAt)),
                        })}
                      </span>
                      <Button variant="danger" onClick={() => revokeInvite.mutate(i.id)} title={t("admin.revoke")}>
                        <Trash2 size={16} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </AdminCard>

          <AdminCard id="backups">
            <section>
              <h2 className="mb-1 text-lg font-semibold">{t("admin.backup")}</h2>
              <p className="mb-3 text-sm text-neutral-500">
                <Rich text={t("admin.backupHelp")} />
              </p>
              <a
                href="/api/admin/backup"
                download
                className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {t("admin.downloadBackup")}
              </a>
            </section>
            <div className="mt-6 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <BackupsAdmin />
            </div>
          </AdminCard>

          <AdminCard id="mail">
            <MailAdmin />
          </AdminCard>

          <AdminCard id="sso">
            <SsoAdmin />
          </AdminCard>

          <AdminCard id="security">
            <SecurityAdmin />
          </AdminCard>

          <AdminCard id="plugins">
            <PluginsAdmin />
          </AdminCard>

          <VersionLine />
        </div>
      </div>
    </div>
  );
}
