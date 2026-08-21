import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { countPostsByUser } from "@/lib/community";
import { getProfile, listGenerations } from "@/lib/data";
import { getMyVideosAction } from "@/app/(app)/agent/actions";
import { getOnboardingStatusAction } from "@/app/(app)/actions";
import { getLang } from "@/lib/i18n.server";

export default async function ProfilePage() {
  const user = await requireUser();
  const [profile, lang, history, postCount, onboarding, videosResult] = await Promise.all([
    getProfile(user.id),
    getLang(),
    listGenerations(user.id),
    countPostsByUser(user.id),
    getOnboardingStatusAction(),
    getMyVideosAction(),
  ]);
  // Same "profile complete" definition Dashboard.tsx used before this
  // moved here — display_name && role both set.
  const profileComplete = Boolean(profile.display_name.trim() && profile.role.trim());
  const recentVideos = videosResult.ok ? videosResult.data.slice(0, 4) : [];

  return (
    <div className="dash">
      <OnboardingChecklist profileComplete={profileComplete} hasGeneration={history.length > 0} lang={lang} />
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <ProfileForm
          profile={profile}
          lang={lang}
          email={user.email}
          createdAt={user.createdAt}
          jobCount={onboarding.jobCount}
          voiceCloned={onboarding.voiceCloned}
          postCount={postCount}
          recentVideos={recentVideos}
        />
      </div>
    </div>
  );
}
