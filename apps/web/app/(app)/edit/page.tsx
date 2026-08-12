import { CrollCreator } from "@/components/CrollCreator";
import { VideoEditor } from "@/components/VideoEditor";
import { VoiceCloneForm } from "@/components/VoiceCloneForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";

export default async function EditPage() {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Video editor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clip or generate one from a photo, then edit it — filler removal, silence cuts, subtitles.
        </p>
      </div>
      <Tabs defaultValue="video">
        <TabsList className="mb-6">
          <TabsTrigger value="video">Upload video</TabsTrigger>
          <TabsTrigger value="croll">Photo → C-roll</TabsTrigger>
          <TabsTrigger value="voice">Voice clone</TabsTrigger>
        </TabsList>
        <TabsContent value="video"><VideoEditor /></TabsContent>
        <TabsContent value="croll"><CrollCreator /></TabsContent>
        <TabsContent value="voice"><VoiceCloneForm /></TabsContent>
      </Tabs>
    </div>
  );
}
