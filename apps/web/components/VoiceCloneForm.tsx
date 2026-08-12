"use client";

import { useState } from "react";
import { createVoiceClone } from "@/app/(app)/edit/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Lang } from "@/lib/i18n";

const DICT = {
  zh: {
    ready: "聲音複製完成。",
    readyBody: "由而家開始，你每次生成 C-roll 都會自動用返呢個複製聲，唔使再撳嘢設定。",
    cloneAnother: "複製另一個樣本",
    voiceSample: "聲音樣本",
    hint: "上傳一段約30秒以上、冇背景噪音嘅你自己把聲錄音 — 用嚟建立一個同你個帳戶綁定嘅 ElevenLabs 即時聲音複製。",
    cloning: "複製緊…",
    submit: "複製我把聲",
  },
  en: {
    ready: "Voice clone ready.",
    readyBody: "Every C-roll you generate from now on automatically uses this cloned voice instead of a stock HeyGen voice — nothing else to configure.",
    cloneAnother: "Clone a different sample",
    voiceSample: "Voice sample",
    hint: "A clean ~30s+ recording of your own voice, no background noise — used once to create an ElevenLabs Instant Voice Clone tied to your account.",
    cloning: "Cloning…",
    submit: "Clone my voice",
  },
} satisfies Record<Lang, unknown>;

export function VoiceCloneForm({ lang }: { lang: Lang }) {
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const t = DICT[lang];

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await createVoiceClone(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVoiceId(result.data.voiceId);
  }

  if (voiceId) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-primary">{t.ready}</p>
          <p className="text-sm text-muted-foreground">{t.readyBody}</p>
          <Button variant="outline" className="w-fit" onClick={() => setVoiceId(null)}>{t.cloneAnother}</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form action={(fd) => handleSubmit(fd)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="audio">{t.voiceSample}</label>
            <input
              id="audio" name="audio" type="file" accept="audio/*" required
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="text-xs text-muted-foreground">{t.hint}</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? t.cloning : t.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
