"use client";

// Profile page — identity header, stats/voice-clone status, sectioned
// edit form, recent activity, and a danger zone. Visual language matches
// OnboardingChecklist/FeatureHub (rounded-2xl cards, color-mix icon
// badges, hand-drawn SVG line icons) so this page stops reading as the
// plainest surface in the app.
import Link from "next/link";
import { useActionState, useState } from "react";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteAccountAction, updateProfileAction, type ProfileFormState } from "@/app/(app)/profile/actions";
import type { Profile } from "@/lib/data";
import type { SavedVideo } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

const initialState: ProfileFormState = {};

const ICONS = {
  video: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3",
  share: "M7 12v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-6 M12 15V4 M8 8l4-4 4 4",
  calendar: "M6.5 3.5v3 M17.5 3.5v3 M4.5 8.5h15 M5.5 6h13a1 1 0 0 1 1 1v11.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  voice: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11a6 6 0 0 0 12 0 M12 17v4 M9 21h6",
  check: "M5 13l4 4L19 7",
  warn: "M12 9v4.5 M12 16.5h.01 M10.6 3.5 2.9 17a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 3.5a1.6 1.6 0 0 0-2.8 0Z",
};

const DICT = {
  zh: {
    identity: "身份",
    displayName: "顯示名稱",
    displayNamePh: "例如：陳大文",
    role: "職業",
    rolePh: "例如：保險從業員/KOL",
    brandVoiceSection: "品牌語氣",
    preferredLang: "內容生成語言",
    brandVoice: "品牌語氣筆記",
    brandVoicePh: "語氣、慣用/忌用字眼、目標客群 — 每次生成劇本/靈感都會用到。",
    brandVoiceHint: "所有靈感工具都會自動用呢個 — 設定一次，唔使每次都打一次。",
    saved: "已儲存。",
    save: "儲存資料",
    saving: "儲存緊…",
    videosMade: "已剪片數",
    postsShared: "已分享帖子",
    memberSince: "加入日期",
    voiceCloneTitle: "聲音克隆",
    voiceCloneDone: "已克隆 — 之後啲片自動用返你把聲",
    voiceCloneMissing: "重未克隆 — 去 Agent 試吓",
    voiceCloneCta: "去 Agent",
    recentActivity: "最近作品",
    recentActivityEmpty: "重未有作品 — 去 Agent 剪你第一條片。",
    recentActivityCta: "睇晒",
    dangerZone: "危險區域",
    dangerZoneCaption: "刪除帳戶會移除你嘅個人資料、靈感記錄同分享過嘅帖子，呢個動作冇得返轉頭。",
    deleteAccount: "刪除帳戶",
    deleteConfirm: "真係要刪除帳戶？呢個動作冇得返轉頭，你嘅個人資料、靈感記錄同帖子都會被移除。",
    deleting: "刪除緊…",
  },
  en: {
    identity: "Identity",
    displayName: "Display name",
    displayNamePh: "e.g. David Chan",
    role: "Role",
    rolePh: "e.g. 保險從業員/KOL",
    brandVoiceSection: "Brand voice",
    preferredLang: "Preferred language",
    brandVoice: "Brand voice notes",
    brandVoicePh: "Tone, phrases to always/never use, target audience — fed into every script/idea this account generates.",
    brandVoiceHint: "Every brainstorm tool includes this automatically — set it once instead of repeating it per prompt.",
    saved: "Saved.",
    save: "Save profile",
    saving: "Saving…",
    videosMade: "Videos made",
    postsShared: "Posts shared",
    memberSince: "Member since",
    voiceCloneTitle: "Voice clone",
    voiceCloneDone: "Cloned — future clips automatically use your voice",
    voiceCloneMissing: "Not cloned yet — try it on the Agent page",
    voiceCloneCta: "Go to Agent",
    recentActivity: "Recent activity",
    recentActivityEmpty: "No videos yet — head to Agent to edit your first one.",
    recentActivityCta: "See all",
    dangerZone: "Danger zone",
    dangerZoneCaption: "Deleting your account removes your profile, generation history, and any posts you've shared. This can't be undone.",
    deleteAccount: "Delete account",
    deleteConfirm: "Really delete your account? This can't be undone — your profile, generation history, and posts will all be removed.",
    deleting: "Deleting…",
  },
} satisfies Record<Lang, Record<string, string>>;

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function fileUrl(jobId: string, path: string | null) {
  const name = path ? path.split(/[/\\]/).pop() : null;
  return name ? `/api/edit-files/${jobId}/${encodeURIComponent(name)}` : null;
}

function formatDate(iso: string, lang: Lang) {
  try {
    return new Date(iso).toLocaleDateString(lang === "zh" ? "zh-HK" : "en-US", { year: "numeric", month: "short" });
  } catch {
    return iso;
  }
}

export function ProfileForm({
  profile, lang, email, createdAt, jobCount, voiceCloned, postCount, recentVideos,
}: {
  profile: Profile;
  lang: Lang;
  email: string;
  createdAt: string;
  jobCount: number;
  voiceCloned: boolean;
  postCount: number;
  recentVideos: SavedVideo[];
}) {
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
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    if (!window.confirm(t.deleteConfirm)) return;
    setDeleting(true);
    await deleteAccountAction();
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <AvatarUpload avatarUrl={profile.avatar_url} displayName={displayName || role} lang={lang} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{displayName || email}</h1>
            <p className="truncate text-[13px] text-muted-foreground">{role ? `${role} · ${email}` : email}</p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { icon: ICONS.video, color: "#3E63FF", label: t.videosMade, value: String(jobCount) },
          { icon: ICONS.share, color: "#8B5CF6", label: t.postsShared, value: String(postCount) },
          { icon: ICONS.calendar, color: "#22C55E", label: t.memberSince, value: formatDate(createdAt, lang) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-3.5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: `color-mix(in srgb, ${stat.color} 14%, transparent)`, color: stat.color }}
            >
              <Icon path={stat.icon} size={15} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-foreground">{stat.value}</p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Voice clone status */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `color-mix(in srgb, ${voiceCloned ? "#22C55E" : "#F59E0B"} 14%, transparent)`,
            color: voiceCloned ? "#22C55E" : "#F59E0B",
          }}
        >
          <Icon path={voiceCloned ? ICONS.check : ICONS.voice} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-foreground">{t.voiceCloneTitle}</h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{voiceCloned ? t.voiceCloneDone : t.voiceCloneMissing}</p>
        </div>
        {!voiceCloned && (
          <Link href="/agent" className="shrink-0 text-[12px] font-semibold text-primary hover:underline">
            {t.voiceCloneCta} →
          </Link>
        )}
      </div>

      {/* Recent activity */}
      {recentVideos.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold text-foreground">{t.recentActivity}</h3>
            <Link href="/videos" className="text-[12px] font-semibold text-primary hover:underline">
              {t.recentActivityCta} →
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto">
            {recentVideos.map((video) => {
              const url = fileUrl(video.job_id, video.final_path);
              return (
                <Link
                  key={video.job_id}
                  href="/videos"
                  className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary"
                >
                  {url && <video src={url} muted className="h-full w-full object-cover" />}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit form, sectioned */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] sm:p-6">
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{t.identity}</h3>
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
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-5">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">{t.brandVoiceSection}</h3>
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
          </div>

          {state.saved && <p className="text-sm text-primary">{t.saved}</p>}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? t.saving : t.save}
          </Button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Icon path={ICONS.warn} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-semibold text-destructive">{t.dangerZone}</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{t.dangerZoneCaption}</p>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteAccount}
              className="mt-3"
            >
              {deleting ? t.deleting : t.deleteAccount}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
