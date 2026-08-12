import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: { title: "個人資料" },
  en: { title: "Profile" },
} satisfies Record<Lang, unknown>;

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, lang] = await Promise.all([getProfile(user.id), getLang()]);
  const t = DICT[lang];

  return (
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
  );
}
