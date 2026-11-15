import { useParams } from "react-router-dom";
import { t } from "@nootion/shared";
import { Avatar } from "../components/Avatar";
import { PagePage } from "./PagePage";
import { useProfile } from "../lib/queries";

export function ProfilePage() {
  const { id = "" } = useParams();
  return <ProfileView id={id} />;
}

export function ProfileView({ id }: { id: string }) {
  const profile = useProfile(id);
  if (profile.isLoading) return null;
  if (profile.isError || !profile.data) {
    return <div className="mx-auto max-w-3xl px-5 py-8 text-neutral-500">Profile not found.</div>;
  }
  const { user, page, groups } = profile.data;
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-center gap-4 border-b border-neutral-200 pb-6 dark:border-neutral-800">
        <Avatar name={user.name} url={user.avatarUrl} size={88} />
        <div className="min-w-0">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("account.profile")}</p>
          <h1 className="truncate text-3xl font-bold text-neutral-900 dark:text-neutral-100">{user.name}</h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">ID: {user.id}</p>
          {groups.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Groups and roles">
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
      <PagePage id={page.id} />
    </div>
  );
}
