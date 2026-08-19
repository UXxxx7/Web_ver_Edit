"use client";

import { useActionState, useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileAction, type ProfileFormState } from "@/app/(app)/profile/actions";
import type { Profile } from "@/lib/data";
import type { Lang } from "@/lib/i18n";

const initialState: ProfileFormState = {};

const DICT = {
  zh: {
    displayName: "顯示名稱",
    displayNamePh: "例如：陳大文",
    role: "職業",
    rolePh: "例如：保險從業員/KOL",
    preferredLang: "內容生成語言",
    brandVoice: "品牌語氣筆記",
    brandVoicePh: "語氣、慣用/忌用字眼、目標客群 — 每次生成劇本/靈感都會用到。",
    brandVoiceHint: "所有靈感工具都會自動用呢個 — 設定一次，唔使每次都打一次。",
    saved: "已儲存。",
    save: "儲存資料",
    saving: "儲存緊…",
  },
  en: {
    displayName: "Display name",
    displayNamePh: "e.g. David Chan",
    role: "Role",
    rolePh: "e.g. 保險從業員/KOL",
    preferredLang: "Preferred language",
    brandVoice: "Brand voice notes",
    brandVoicePh: "Tone, phrases to always/never use, target audience — fed into every script/idea this account generates.",
    brandVoiceHint: "Every brainstorm tool includes this automatically — set it once instead of repeating it per prompt.",
    saved: "Saved.",
    save: "Save profile",
    saving: "Saving…",
  },
} satisfies Record<Lang, unknown>;

export function ProfileForm({ profile, lang }: { profile: Profile; lang: Lang }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const t = DICT[lang];

  // Controlled, not defaultValue — updateProfileAction revalidates the
  // Server Component, which re-fetches profile and passes a new value into
  // this same (not remounted) Client Component instance. defaultValue only
  // applies at mount, so that prop change was firing Base UI's "changing
  // default value of an uncontrolled field" warning on every save.
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [role, setRole] = useState(profile.role);
  const [preferredLang, setPreferredLang] = useState(profile.preferred_lang);
  const [brandVoiceNotes, setBrandVoiceNotes] = useState(profile.brand_voice_notes);

  return (
    <div className="flex flex-col gap-6">
      <AvatarUpload avatarUrl={profile.avatar_url} displayName={displayName || profile.role} lang={lang} />
      <form action={formAction} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display_name">{t.displayName}</Label>
            <Input
              id="display_name" name="display_name" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)} placeholder={t.displayNamePh}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">{t.role}</Label>
            <Input
              id="role" name="role" value={role}
              onChange={(e) => setRole(e.target.value)} placeholder={t.rolePh}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preferred_lang">{t.preferredLang}</Label>
          <select
            id="preferred_lang"
            name="preferred_lang"
            value={preferredLang}
            onChange={(e) => setPreferredLang(e.target.value as Profile["preferred_lang"])}
            className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="zh">中文（廣東話）</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand_voice_notes">{t.brandVoice}</Label>
          <Textarea
            id="brand_voice_notes"
            name="brand_voice_notes"
            value={brandVoiceNotes}
            onChange={(e) => setBrandVoiceNotes(e.target.value)}
            rows={4}
            placeholder={t.brandVoicePh}
          />
          <p className="text-xs text-muted-foreground">{t.brandVoiceHint}</p>
        </div>

        {state.saved && <p className="text-sm text-primary">{t.saved}</p>}
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? t.saving : t.save}
        </Button>
      </form>
    </div>
  );
}
