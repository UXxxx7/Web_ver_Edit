import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // Redirect to the /clear-session Route Handler, not straight to
    // /login: cookies can only be written from a Server Action/Route
    // Handler/Middleware, never from a Server Component's own render (hit
    // this live — calling signOut() directly here crashed every page with
    // "Cookies can only be modified in a Server Action or Route Handler").
    // See /clear-session/route.ts's own header for why clearing the
    // cookie here (rather than just redirecting past the disagreement
    // again) is what actually breaks the /login <-> "/" loop a
    // validly-signed-but-nobody-home cookie causes.
    redirect("/clear-session");
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
