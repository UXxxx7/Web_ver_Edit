import { DashboardHome } from "@/components/DashboardHome";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";

export default async function DashboardPage() {
  const user = await requireUser();
  const [profile, lang] = await Promise.all([getProfile(user.id), getLang()]);
  return <DashboardHome profileRole={profile.role} lang={lang} />;
}
