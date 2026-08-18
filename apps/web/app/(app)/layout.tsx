import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";
import { signOutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login"); // proxy.ts already guards this; belt-and-suspenders for direct server-render.
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
