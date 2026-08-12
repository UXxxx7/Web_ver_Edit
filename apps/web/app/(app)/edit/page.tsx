import { VideoEditor } from "@/components/VideoEditor";
import { requireUser } from "@/lib/auth";

export default async function EditPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Video editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a talking-head clip and describe the edit — filler removal, silence cuts, subtitles.
        </p>
      </div>
      <VideoEditor />
    </div>
  );
}
