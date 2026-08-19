import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { getCurrentUser, signOut } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // signOut() first, not just redirect: proxy.ts only checks the
    // session cookie's own HMAC signature (cheap, edge-safe — see its own
    // header comment on why it can't afford lib/auth.ts's heavier
    // dependencies), so a cookie can still verify as "signed in" there
    // even when the user row it points at is gone (confirmed real
    // incident: every mock-mode account vanished on a container rebuild
    // because lib/store.ts's db.json had no persistent volume — since
    // fixed, see docker-compose.yml — but SESSION_SECRET itself doesn't
    // change on a rebuild, so the already-issued cookie's signature kept
    // verifying regardless). proxy.ts would then bounce that "validly
    // signed but nobody home" cookie away from /login, landing here,
    // which bounced it right back to /login — forever, since neither side
    // ever cleared the cookie causing the disagreement. Clearing it here
    // is what actually breaks the loop, independent of whatever put us in
    // this state — a real defense-in-depth, not just cleanup for this one
    // known cause.
    await signOut();
    redirect("/login");
  }
  const [profile, lang] = await Promise.all([getProfile(user.id), getLang()]);
  const avatarInitial = (profile.display_name || user.email).trim().charAt(0).toUpperCase();

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground lg:flex-row">
      <AppSidebar
        lang={lang}
        userEmail={user.email}
        avatarUrl={profile.avatar_url}
        avatarInitial={avatarInitial}
        signOutAction={signOutAction}
      />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
