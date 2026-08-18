import { MyVideos } from "@/components/MyVideos";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n.server";

export default async function VideosPage() {
  await requireUser();
  const lang = await getLang();
  return (
    <div className="dash">
      <MyVideos lang={lang} />
    </div>
  );
}
