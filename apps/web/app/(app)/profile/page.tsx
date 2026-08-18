import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { getProfile, listGenerations } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: { title: "個人資料" },
  en: { title: "Profile" },
} satisfies Record<Lang, unknown>;

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, lang, history] = await Promise.all([getProfile(user.id), getLang(), listGenerations(user.id)]);
  const t = DICT[lang];
  // Same "profile complete" definition Dashboard.tsx used before this
  // moved here — display_name && role both set.
  const profileComplete = Boolean(profile.display_name.trim() && profile.role.trim());

  return (
    <div className="dash">
      <OnboardingChecklist profileComplete={profileComplete} hasGeneration={history.length > 0} lang={lang} />
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} lang={lang} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
