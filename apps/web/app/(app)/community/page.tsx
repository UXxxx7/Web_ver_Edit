import { CommunityFeed } from "@/components/CommunityFeed";
import { requireUser } from "@/lib/auth";
import * as community from "@/lib/community";
import { getLang } from "@/lib/i18n.server";

export default async function CommunityPage() {
  const user = await requireUser();
  const [initialPosts, lang] = await Promise.all([community.listPosts(user.id), getLang()]);
  return <CommunityFeed initialPosts={initialPosts} currentUserId={user.id} lang={lang} />;
}
