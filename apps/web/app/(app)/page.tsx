import { Dashboard } from "@/components/Dashboard";
import { requireUser } from "@/lib/auth";
import { getProfile, listGenerations } from "@/lib/data";

export default async function DashboardPage() {
  const user = await requireUser();
  const [history, profile] = await Promise.all([listGenerations(user.id), getProfile(user.id)]);
  const profileComplete = Boolean(profile.display_name.trim() && profile.role.trim());
  return <Dashboard initialHistory={history} profileRole={profile.role} profileComplete={profileComplete} />;
}
