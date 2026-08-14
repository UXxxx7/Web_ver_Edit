import { MyVideos } from "@/components/MyVideos";
import { requireUser } from "@/lib/auth";

export default async function VideosPage() {
  await requireUser();
  return (
    <div className="dash">
      <MyVideos />
    </div>
  );
}
