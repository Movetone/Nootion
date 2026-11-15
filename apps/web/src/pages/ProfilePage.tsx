import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "../components/Avatar";
import { AddCoverButton, PageCover } from "../components/PageCover";
import { api } from "../lib/api";
import { keys, usePage, useProfile } from "../lib/queries";
import { PagePage } from "./PagePage";

export function ProfilePage() {
  const { id = "" } = useParams();
  return <ProfileView id={id} />;
}

export function ProfileView({ id }: { id: string }) {
  const profile = useProfile(id);
  const profilePage = usePage(profile.data?.page.id ?? "");
  const qc = useQueryClient();
  if (profile.isLoading) return null;
  if (profile.isError || !profile.data) {
    return <div className="mx-auto max-w-3xl px-5 py-8 text-neutral-500">Profile not found.</div>;
  }
  const { user, page, groups } = profile.data;
  const detail = profilePage.data;
  const canEditCover = detail?.role === "full";
  const saveCover = async (patch: { cover?: string | null; coverPosition?: number }) => {
    await api(`/pages/${page.id}`, { method: "PATCH", body: patch });
    await qc.invalidateQueries({ queryKey: keys.page(page.id) });
  };

  return (
    <div className="mx-auto max-w-4xl px-5 pb-8 sm:px-8 sm:pb-12">
      <header className="mb-8 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/40">
        {detail?.cover ? (
          <PageCover pageId={page.id} cover={detail.cover} position={detail.coverPosition} editable={canEditCover} onChange={saveCover} />
        ) : (
          <div className="h-20 bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900" />
        )}
        <div className="relative -mt-16 bg-gradient-to-t from-white via-white/95 to-transparent px-5 pb-5 pt-16 sm:px-8 dark:from-neutral-900 dark:via-neutral-900/95">
          <div className="flex flex-wrap items-end gap-4">
            <span className="rounded-full ring-4 ring-white dark:ring-neutral-900">
              <Avatar name={user.name} url={user.avatarUrl} size={96} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-3xl font-bold text-neutral-900 dark:text-neutral-100">{user.name}</h1>
              {user.status && <p className="mt-1 text-sm italic text-neutral-500 dark:text-neutral-400">{user.status}</p>}
            </div>
            {canEditCover && !detail?.cover && <AddCoverButton pageId={page.id} onChange={saveCover} />}
          </div>
          {groups.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Groups and roles">
              {groups.map((group) => (
                <span
                  key={group.id}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs dark:border-neutral-700"
                  style={group.color ? { borderColor: group.color, color: group.color } : undefined}
                  title={group.description || undefined}
                >
                  {group.icon ? `${group.icon} ` : ""}
                  {group.name}
                  {group.roles.length > 0 ? ` · ${group.roles.map((role) => role.name).join(", ")}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>
      <PagePage id={page.id} hideChrome />
    </div>
  );
}
