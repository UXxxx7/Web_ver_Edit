import { Dashboard } from "@/components/Dashboard";
import { requireUser } from "@/lib/auth";
import { getProfile, listGenerations } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";

export default async function DashboardPage() {
  const user = await requireUser();
  const [history, profile, uiLang] = await Promise.all([
    listGenerations(user.id),
    getProfile(user.id),
    getLang(),
  ]);
  const profileComplete = Boolean(profile.display_name.trim() && profile.role.trim());
  return <Dashboard initialHistory={history} role={profile.role} profileComplete={profileComplete} uiLang={uiLang} />;
}
