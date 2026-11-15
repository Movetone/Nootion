import { useSession } from "../lib/session";
import { ProfileView } from "./ProfilePage";

/** Home is the current user's profile and personal Nootion page. */
export function HomePage() {
  const { user } = useSession();
  if (!user) return null;
  return <ProfileView id={user.id} />;
}
