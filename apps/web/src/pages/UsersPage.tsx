import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Users as UsersIcon } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { useUserDirectory } from "../lib/queries";

export function UsersPage() {
  const users = useUserDirectory();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (users.data ?? []).filter((user) => !needle || `${user.name} ${user.email} ${user.id}`.toLocaleLowerCase().includes(needle));
  }, [search, users.data]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <UsersIcon size={18} /> Users
          </div>
          <h1 className="mt-1 text-3xl font-bold">People</h1>
          <p className="mt-2 text-sm text-neutral-500">Open a profile to see a user's page, groups, and roles.</p>
        </div>
        <label className="flex min-w-64 items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700">
          <Search size={16} className="text-neutral-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search users"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {users.isLoading ? (
        <p className="text-sm text-neutral-500">Loading users…</p>
      ) : users.isError ? (
        <p className="text-sm text-red-600">Unable to load users.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((user) => (
            <Link
              key={user.id}
              to={`/profile/${user.id}`}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-400 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:border-neutral-600"
            >
              <Avatar name={user.name} url={user.avatarUrl} size={48} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{user.name}</span>
                <span className="block truncate text-sm text-neutral-500">{user.email}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
      {!users.isLoading && !users.isError && filtered.length === 0 && <p className="text-sm text-neutral-500">No users found.</p>}
    </div>
  );
}
