import { CrollCreator } from "@/components/CrollCreator";
import { VideoEditor } from "@/components/VideoEditor";
import { VoiceCloneForm } from "@/components/VoiceCloneForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/i18n.server";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    title: "影片編輯",
    desc: "上載一段片，或者用一張相生成一段 — 再剪接：刪走贅字、剪走靜音位、加字幕。",
    uploadVideo: "上載影片",
    croll: "相片 → C-roll",
    voice: "複製聲音",
  },
  en: {
    title: "Video editor",
    desc: "Upload a clip or generate one from a photo, then edit it — filler removal, silence cuts, subtitles.",
    uploadVideo: "Upload video",
    croll: "Photo → C-roll",
    voice: "Voice clone",
  },
} satisfies Record<Lang, unknown>;

export default async function EditPage() {
  await requireUser();
  const lang = await getLang();
  const t = DICT[lang];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
      </div>
      <Tabs defaultValue="video">
        <TabsList className="mb-6">
          <TabsTrigger value="video">{t.uploadVideo}</TabsTrigger>
          <TabsTrigger value="croll">{t.croll}</TabsTrigger>
          <TabsTrigger value="voice">{t.voice}</TabsTrigger>
        </TabsList>
        <TabsContent value="video"><VideoEditor lang={lang} /></TabsContent>
        <TabsContent value="croll"><CrollCreator lang={lang} /></TabsContent>
        <TabsContent value="voice"><VoiceCloneForm lang={lang} /></TabsContent>
      </Tabs>
    </div>
  );
}
