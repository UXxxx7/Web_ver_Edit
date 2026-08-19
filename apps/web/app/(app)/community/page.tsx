import { CommunityFeed } from "@/components/CommunityFeed";
import { requireUser } from "@/lib/auth";
import * as community from "@/lib/community";
import { getProfile } from "@/lib/data";
import { getLang } from "@/lib/i18n.server";

export default async function CommunityPage() {
  const user = await requireUser();
  const [initialPosts, lang, profile] = await Promise.all([
    community.listPosts(user.id), getLang(), getProfile(user.id),
  ]);
  // Same fallback createPostAction itself uses when actually posting —
  // keeps the compose prompt's avatar showing the name a post would
  // actually be attributed to, not a generic placeholder.
  const currentUserName = profile.display_name.trim() || user.email;
  return (
    <div className="dash">
      <CommunityFeed
        initialPosts={initialPosts}
        currentUserId={user.id}
        currentUserName={currentUserName}
        currentUserAvatarUrl={profile.avatar_url}
        lang={lang}
      />
    </div>
  );
}
