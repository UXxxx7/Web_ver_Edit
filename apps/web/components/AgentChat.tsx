"use client";

// The "agent auto-generates a video" surface, redesigned to match the
// original WhatsApp interaction: one conversation thread, one compose bar
// (attach + text + send) — not separate tabs/forms. What kind of media is
// attached decides what happens next (video -> edit job, photo -> C-roll,
// audio -> voice clone), the same dispatch _handle_message used to do by
// reading msg_type in webhook.py before that logic was stripped out as
// WhatsApp-specific (see webhook.py's own header comment) — reproducing
// the *interaction shape* here, not the removed WhatsApp-message code.
//
// The compose bar's single attachment was upgraded to a multi-asset tray so
// the Arm-B (AI-authored) inputs the backend already accepts can be sent:
// one main video + an optional style reference + any number of manual b-roll
// clips (each with a cue), plus an arm selector (套用模板 / AI 现写). C-roll
// (single photo) and voice-clone (single audio) keep their single-file paths;
// only the video-edit job uses the multi-asset assembly. See
// armb_web_wiring_plan.md §5.
import { useEffect, useRef, useState } from "react";
import { createCrollJob, createEditJob, createVoiceClone, getEditJobStatus } from "@/app/(app)/agent/actions";
import { AgentJobBubble } from "@/components/AgentJobBubble";
import { RecentCreationsRail } from "@/components/RecentCreationsRail";
import { addRecentJob } from "@/lib/recent-jobs";
import { loadChatHistory, saveChatHistory } from "@/lib/agent-chat-history";
import type { EditJob } from "@/lib/edit-jobs";
import type { Lang } from "@/lib/i18n";

type Media = "video" | "image" | "audio";
type Role = "main" | "reference" | "broll";
type Arm = "arm_a" | "arm_b";

type Asset = {
  id: string;
  file: File;
  media: Media;
  role: Role;   // meaningful only for the video-edit path; cosmetic for C-roll/voice-clone
  cue: string;  // only used when role === "broll" -> broll_labels
};

type ChatMsg =
  | { id: string; role: "user"; text: string; attachmentName?: string }
  | { id: string; role: "bot"; kind: "text"; text: string }
  | { id: string; role: "bot"; kind: "job"; job: EditJob };

// Same "reverse by turn, newest first" treatment as Dashboard.tsx's
// BrainstormPanel history — a turn starts at each user message and keeps
// every bot message that follows until the next one, so a question always
// stays directly above its own answer once reversed. Unlike Dashboard's
// messages (always pushed as strict [user, bot] pairs), AgentChat can also
// push an orphan bot message with no preceding user turn yet (addFiles'
// unsupportedFile validation, before Send is even pressed) — grouping by
// "starts a new turn on role==='user', else joins the current one" handles
// that too instead of assuming pairs of exactly 2.
function groupIntoTurns(messages: ChatMsg[]): ChatMsg[][] {
  const turns: ChatMsg[][] = [];
  for (const msg of messages) {
    if (msg.role === "user" || turns.length === 0) {
      turns.push([msg]);
    } else {
      turns[turns.length - 1].push(msg);
    }
  }
  return turns;
}

function mediaOf(file: File): Media | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

// Hand-drawn line icons, same treatment as Dashboard/FeatureHub/
// TemplateGallery — no emoji anywhere in the app.
const ICONS = {
  attach: "M17.5 7.5 9 16a3 3 0 1 1-4.24-4.24L13.5 3a4.5 4.5 0 1 1 6.36 6.36L11.5 17.5",
  video: "M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v11A1.5 1.5 0 0 1 14.5 19h-9A1.5 1.5 0 0 1 4 17.5v-11Z M16 9.5l4-2.3v9.6l-4-2.3",
  image: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z M4 15l4.5-4.5a1.5 1.5 0 0 1 2.1 0L14 14M14 14l1.4-1.4a1.5 1.5 0 0 1 2.1 0L20 15 M9.5 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  audio: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M6 11v1a6 6 0 0 0 12 0v-1 M12 18v3M9 21h6",
  captions: "M4 8.5A1.5 1.5 0 0 1 5.5 7h13A1.5 1.5 0 0 1 20 8.5v5A1.5 1.5 0 0 1 18.5 15H10l-4 3v-3H5.5A1.5 1.5 0 0 1 4 13.5v-5Z M7.5 10v2.2M10.5 9.3v3.6M13.5 10v2.2M16.5 9.3v3.6",
  volumeUp: "M4 9v6h4l5 5V4L8 9H4Z M15.5 8.5a5 5 0 0 1 0 7",
  volumeMute: "M4 9v6h4l5 5V4L8 9H4Z M16 9l4 4m0-4-4 4",
  plus: "M12 5v14M5 12h14",
  arrowUp: "M12 19V5 M5 12l7-7 7 7",
  // Same path as CommunityFeed.tsx's ICONS.trash — kept identical so
  // "remove this" reads as the same action across the app.
  trash: "M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13 M10 11v6 M14 11v6",
};

function Icon({ path, size = 13 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="inline-block shrink-0 align-[-2.5px]">
      <path d={path} />
    </svg>
  );
}

// Quick-action chips — fill the compose text with a ready instruction so a
// user doesn't have to phrase "add captions" or "clean up the audio"
// themselves. Audio-cleanup options name the actual presets
// tools/audio/audio_enhance.py already implements (clean_speech,
// noise_reduce, podcast), not invented ones — the planner has a real
// filter chain to map each phrase onto. Caption styles map onto the
// captions.* fields in contracts/style_params.schema.json (position,
// karaoke, highlightColor) via the planner's own free-text understanding,
// same mechanism as any other edit_request — no new backend plumbing.
const QUICK_ACTIONS: Record<Lang, { icon: string; label: string; text: string }[]> = {
  zh: [
    { icon: ICONS.captions, label: "TikTok字幕", text: "加字幕，用TikTok風格：大隻黃色字，逐隻字highlight，擺喺畫面中下方。" },
    { icon: ICONS.captions, label: "簡約字幕", text: "加字幕，簡約風格：細粒白色字，喺畫面最底，唔使highlight效果。" },
    { icon: ICONS.volumeUp, label: "人聲清晰", text: "洗靚把聲：人聲清晰，減走吵耳嘅背景雜音（clean_speech）。" },
    { icon: ICONS.volumeMute, label: "強力降噪", text: "把聲環境好嘈，幫我強力降噪（noise_reduce）。" },
  ],
  en: [
    { icon: ICONS.captions, label: "TikTok captions", text: "Add captions, TikTok style: big bold yellow text, word-by-word highlight, lower-middle of the screen." },
    { icon: ICONS.captions, label: "Minimal captions", text: "Add captions, minimal style: small white text, bottom of the screen, no highlight effect." },
    { icon: ICONS.volumeUp, label: "Clean speech", text: "Clean up the audio: clear speech, remove distracting background noise (clean_speech)." },
    { icon: ICONS.volumeMute, label: "Heavy noise reduction", text: "The audio environment is very noisy — apply heavy noise reduction (noise_reduce)." },
  ],
};

// What each attachment type actually does — the compose bar accepts video,
// photo, or a voice sample, but nothing else on the page says what each
// one is for until you've already attached something. Same tinted-card
// treatment as FeatureHub's secondary cards, so the empty state reads as
// part of the same product rather than a bare placeholder message.
const USES: Record<Lang, { icon: string; color: string; title: string; body: string }[]> = {
  zh: [
    { icon: ICONS.video, color: "#3E63FF", title: "上載一條片", body: "AI幫你剪走贅字、加字幕、裁做直度。" },
    { icon: ICONS.image, color: "#8B5CF6", title: "上載一張相", body: "一鍵生成識講嘢嘅數碼人影片。" },
    { icon: ICONS.audio, color: "#22C55E", title: "上載聲音樣本", body: "複製你把聲，之後可以攞嚟配音。" },
  ],
  en: [
    { icon: ICONS.video, color: "#3E63FF", title: "Upload a video", body: "AI trims filler words, adds captions, and reframes to vertical." },
    { icon: ICONS.image, color: "#8B5CF6", title: "Upload a photo", body: "One click generates a talking digital-human clip." },
    { icon: ICONS.audio, color: "#22C55E", title: "Upload a voice sample", body: "Clones your voice, usable for dubbing afterwards." },
  ],
};

const AGENT_T = {
  zh: {
    introHeading: "上載一條片、相，或者聲音樣本",
    introSub: "同AI講你想點剪，例如「剪走贅字、加字幕」——揀低面任何一種開始。",
    unsupportedFile: "呢個檔案格式唔支援 — 上載影片、相片或者聲音樣本。",
    mixedAssets: "呢啲素材冚唔埋一齊處理：影片剪輯淨係放1條主影片（可以加多條參考影片/幾條 b-roll）；生成數碼人淨係放1張相；克隆聲音淨係放1段錄音。",
    needMain: "請將其中一條影片嘅角色設做「主影片」。",
    onlyOneMain: "淨係可以有一條「主影片」，其餘影片請設做 B-roll 或者參考風格。",
    filesCount: (n: number) => `${n} 個檔案`,
    fallbackReply: "俾條片我，話我知想點剪（例如「剪走靜音位、加字幕」）。或者上載一張相生成識講嘢嘅數碼人片，或者上載聲音樣本嚟克隆把聲。",
    voiceCloneReady: "把聲克隆完成 — 之後嘅數碼人片會自動用返你把聲，唔會再用預設聲。",
    dropToUpload: "放低嚟上載",
    roleLabel: "素材角色",
    mainRole: "主影片", referenceRole: "參考風格", brollRole: "B-roll",
    cuePlaceholder: "插入線索（可選，例：講到某個位嘅時候）",
    remove: "移除",
    editedPlaceholder: "講吓你想點剪…",
    startPlaceholder: "打段訊息，或者上載影片/相片/聲音樣本…",
    attachTitle: "上載影片、相片或者聲音樣本",
    applyTemplate: "套用模板",
    aiWrite: "AI 現寫",
    send: "傳送",
    noMessage: "（冇訊息）",
  },
  en: {
    introHeading: "Upload a video, photo, or voice sample",
    introSub: "Tell AI how you want it edited (e.g. \"trim filler words, add captions\") — pick any of these to start.",
    unsupportedFile: "That file type isn't supported — attach a video, photo, or audio sample.",
    mixedAssets: "These assets can't be processed together: video editing takes 1 main video (plus an optional reference video / several b-roll clips); generating a digital human takes 1 photo; cloning a voice takes 1 audio sample.",
    needMain: "Set one of the videos' role to \"Main video\".",
    onlyOneMain: "Only one video can be \"Main\" — set the others to B-roll or Style reference.",
    filesCount: (n: number) => `${n} files`,
    fallbackReply:
      "Send me a video and tell me how you'd like it edited (e.g. \"remove dead air, add subtitles\"). " +
      "Or attach a photo to generate a talking digital-human clip, or a voice sample to clone your voice.",
    voiceCloneReady: "Voice clone ready — future digital-human clips from you automatically use this voice instead of a stock one.",
    dropToUpload: "Drop to upload",
    roleLabel: "Asset role",
    mainRole: "Main video", referenceRole: "Style reference", brollRole: "B-roll",
    cuePlaceholder: "Insertion cue (optional, e.g. \"when mentioning vscode\")",
    remove: "Remove",
    editedPlaceholder: "Say how you want it edited…",
    startPlaceholder: "Type a message, or attach a video/photo/voice sample…",
    attachTitle: "Attach video, photo, or voice sample",
    applyTemplate: "Apply template",
    aiWrite: "AI-authored",
    send: "Send",
    noMessage: "(no message)",
  },
} satisfies Record<Lang, {
  introHeading: string; introSub: string; unsupportedFile: string; mixedAssets: string; needMain: string;
  onlyOneMain: string; filesCount: (n: number) => string; fallbackReply: string; voiceCloneReady: string;
  dropToUpload: string; roleLabel: string; mainRole: string; referenceRole: string; brollRole: string;
  cuePlaceholder: string; remove: string; editedPlaceholder: string; startPlaceholder: string;
  attachTitle: string; applyTemplate: string; aiWrite: string; send: string; noMessage: string;
}>;

function AgentIntro({ onAttach, lang }: { onAttach: () => void; lang: Lang }) {
  const t = AGENT_T[lang];
  const uses = USES[lang];
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:py-16">
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">
        {t.introHeading}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
        {t.introSub}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {uses.map((use) => (
          <button
            key={use.title}
            type="button"
            onClick={onAttach}
            className="flex flex-col items-start rounded-2xl border border-border bg-card p-4 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-8px_rgba(15,27,60,0.16)]"
          >
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${use.color} 12%, transparent)`, color: use.color }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d={use.icon} />
              </svg>
            </span>
            <h3 className="mt-3 text-[14px] font-semibold text-foreground">{use.title}</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{use.body}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgentChat({ lang }: { lang: Lang }) {
  const t = AGENT_T[lang];
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  // Restore after mount, not via a useState lazy initializer — this
  // component is server-rendered first (it's a Client Component, but
  // Next.js still renders it to HTML on the server for the initial
  // payload), where `window`/localStorage don't exist, so a lazy
  // initializer would only ever see history on the client. That made the
  // server's HTML (always empty-state) disagree with the client's very
  // first render (real restored messages) — a hydration mismatch React
  // detects and "fixes" by discarding the server HTML and re-rendering the
  // whole tree client-side. Starting both at [] and restoring here, after
  // hydration, keeps server and first-client-render identical; the restore
  // itself then lands a frame later as an ordinary post-mount state update
  // (same pattern MyVideos.tsx/EditorPicker.tsx already use for their own
  // localStorage-backed lists).
  const restoredRef = useRef(false);
  useEffect(() => {
    // Deferred to a microtask (same reasoning as MyVideos.tsx/
    // EditorPicker.tsx's own Promise-based restores) — calling setState
    // synchronously in the effect body trips eslint's
    // react-hooks/set-state-in-effect (caught by CI, not local tsc).
    Promise.resolve().then(() => {
      setMessages(loadChatHistory<ChatMsg>());
      restoredRef.current = true;
    });
  }, []);
  // Persist on every change, not just on unmount — unmount isn't guaranteed
  // to run in time for a hard navigation/tab close, and this is cheap.
  // Gated on restoredRef: on the very first mount this effect and the
  // restore effect above both fire in the same pass, before setMessages
  // above has actually taken effect — without the guard this would run
  // first with the still-empty initial `messages` and clobber whatever was
  // saved, a moment before the restore effect even reads it back.
  useEffect(() => {
    if (restoredRef.current) saveChatHistory(messages);
  }, [messages]);
  const [text, setText] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [arm, setArm] = useState<Arm>("arm_a");
  const [sending, setSending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idCounter = useRef(0);
  const nextId = () => `m${Date.now()}-${idCounter.current++}`;

  const hasVideo = assets.some((a) => a.media === "video");
  const showIntro = messages.length === 0;

  function pushBotText(text: string) {
    setMessages((m) => [...m, { id: nextId(), role: "bot", kind: "text", text }]);
  }

  function updateJobMessage(id: string, job: EditJob) {
    setMessages((m) =>
      m.map((msg) => (msg.id === id && msg.role === "bot" && msg.kind === "job" ? { ...msg, job } : msg))
    );
  }

  function handleAttachClick() {
    fileInputRef.current?.click();
  }

  // Shared by the 📎 button's hidden <input> (FileList from an <input
  // onChange>) and drag-and-drop (FileList from a DataTransfer) — same
  // staging rules either way, so dropping a video behaves identically to
  // clicking attach and picking it.
  function addFiles(chosen: File[]) {
    if (chosen.length === 0) return;

    setAssets((prev) => {
      const next = [...prev];
      let mainExists = next.some((a) => a.role === "main" && a.media === "video");
      for (const file of chosen) {
        const media = mediaOf(file);
        if (!media) {
          pushBotText(t.unsupportedFile);
          continue;
        }
        // First video with no main yet -> main; every other video/image -> broll.
        let role: Role = "broll";
        if (media === "video" && !mainExists) {
          role = "main";
          mainExists = true;
        }
        next.push({ id: nextId(), file, media, role, cue: "" });
      }
      return next;
    });
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = "";
    addFiles(chosen);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  }

  function setAssetRole(id: string, role: Role) {
    setAssets((prev) => {
      let next = prev.map((a) => (a.id === id ? { ...a, role } : a));
      // Reference is at most one — demote any other reference to broll.
      if (role === "reference") {
        next = next.map((a) => (a.id !== id && a.role === "reference" ? { ...a, role: "broll" } : a));
      }
      return next;
    });
  }

  function setAssetCue(id: string, cue: string) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, cue } : a)));
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  function resetComposer() {
    setText("");
    setAssets([]);
    setArm("arm_a");
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && assets.length === 0) return;

    // Dispatch by media composition of the tray (not by role) — mirrors the
    // WhatsApp msg_type dispatch. Validate before we mutate the thread.
    const videos = assets.filter((a) => a.media === "video");
    const images = assets.filter((a) => a.media === "image");
    const audios = assets.filter((a) => a.media === "audio");

    let mode: "chat" | "video" | "croll" | "voice";
    if (assets.length === 0) {
      mode = "chat";
    } else if (videos.length > 0) {
      mode = "video";
    } else if (images.length === 1 && audios.length === 0) {
      mode = "croll";
    } else if (audios.length === 1 && images.length === 0) {
      mode = "voice";
    } else {
      pushBotText(t.mixedAssets);
      return;
    }

    // For the video path, require exactly one Main video before touching state.
    if (mode === "video") {
      const mains = assets.filter((a) => a.role === "main" && a.media === "video");
      if (mains.length === 0) {
        pushBotText(t.needMain);
        return;
      }
      if (mains.length > 1) {
        pushBotText(t.onlyOneMain);
        return;
      }
    }

    setSending(true);
    const summary =
      assets.length === 0 ? undefined :
      assets.length === 1 ? assets[0].file.name :
      t.filesCount(assets.length);
    const userMsgId = nextId();
    setMessages((m) => [...m, { id: userMsgId, role: "user", text: trimmed, attachmentName: summary }]);

    const snapshot = assets;
    const snapshotArm = arm;
    resetComposer();

    if (mode === "chat") {
      pushBotText(t.fallbackReply);
      setSending(false);
      return;
    }

    if (mode === "voice") {
      const form = new FormData();
      form.set("audio", snapshot[0].file);
      const result = await createVoiceClone(form);
      pushBotText(result.ok ? t.voiceCloneReady : result.error);
      setSending(false);
      return;
    }

    const botId = nextId();
    setMessages((m) => [...m, { id: botId, role: "bot", kind: "job", job: PENDING_JOB }]);

    let result;
    if (mode === "croll") {
      const form = new FormData();
      form.set("photo", snapshot[0].file);
      form.set("hint", trimmed);
      form.set("lang", /[一-鿿]/.test(trimmed) ? "zh" : "en");
      result = await createCrollJob(form);
    } else {
      // mode === "video": assemble main + optional reference + b-roll[] + arm.
      const main = snapshot.find((a) => a.role === "main" && a.media === "video")!;
      const reference = snapshot.find((a) => a.role === "reference") ?? null;
      const brolls = snapshot.filter((a) => a.role === "broll");

      const form = new FormData();
      form.set("video", main.file);
      form.set("edit_request", trimmed);
      form.set("arm", snapshotArm);
      if (reference) {
        form.set("reference", reference.file);
        form.set("reference_kind", reference.media === "image" ? "image" : "video");
      }
      for (const b of brolls) {
        form.append("broll", b.file);
        form.append("broll_labels", b.cue.trim());
        form.append("broll_kinds", b.media === "image" ? "image" : "video");
      }
      result = await createEditJob(form);
    }

    if (!result.ok) {
      setMessages((m) => m.map((msg) => (msg.id === botId ? { id: botId, role: "bot", kind: "text", text: result.error } : msg)));
      setSending(false);
      return;
    }
    addRecentJob(result.data.jobId);   // so CommunityFeed's share picker can list it (see recent-jobs.ts's own header)
    const status = await getEditJobStatus(result.data.jobId);
    if (status.ok) updateJobMessage(botId, status.data);
    setSending(false);
  }

  return (
    <div
      className={`dash agent-dropzone${dragActive ? " is-drag-active" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        // Only clear on leaving the container itself, not a child element —
        // dragging over the compose bar/thread fires leave+enter on every
        // child boundary crossed, which would otherwise flicker the overlay.
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={handleDrop}
    >
      {dragActive && (
        <div className="agent-dropzone-overlay" aria-hidden>
          <p>
            <Icon path={ICONS.attach} size={14} /> {t.dropToUpload}
          </p>
        </div>
      )}
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Compose lives above the thread now, not below it — the thread
              reverses newest-turn-first (same as Dashboard.tsx's
              BrainstormPanel), so the box you just typed into should sit
              directly above the reply it just produced instead of at the
              opposite end of the page. Mirrors BrainstormPanel's own
              layout: input card up top, results flowing down below it.
              showIntro's own top padding covers the empty-state's breathing
              room; once a conversation exists AgentIntro is gone, so this
              pt- carries that same breathing room instead of the compose
              card sitting flush against the page's top edge. */}
          <div className={showIntro ? undefined : "pt-8 sm:pt-10"}>
            {showIntro && <AgentIntro onAttach={handleAttachClick} lang={lang} />}
          </div>
          {assets.length > 0 && (
            <div className="flex flex-col gap-2 px-4 pt-4 sm:px-5">
              <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2">
                {assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        <Icon path={a.media === "video" ? ICONS.video : a.media === "image" ? ICONS.image : ICONS.audio} size={15} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{a.file.name}</span>
                      <select
                        value={a.role}
                        onChange={(e) => setAssetRole(a.id, e.target.value as Role)}
                        aria-label={t.roleLabel}
                        className="shrink-0 rounded-lg border border-border bg-secondary/60 px-2 py-1 text-[12px] font-medium text-foreground outline-none transition-colors focus-visible:border-primary"
                      >
                        <option value="main">{t.mainRole}</option>
                        <option value="reference">{t.referenceRole}</option>
                        <option value="broll">{t.brollRole}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeAsset(a.id)}
                        aria-label={t.remove}
                        title={t.remove}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                      >
                        <Icon path={ICONS.trash} size={14} />
                      </button>
                    </div>
                    {a.role === "broll" && (
                      <input
                        type="text"
                        value={a.cue}
                        placeholder={t.cuePlaceholder}
                        onChange={(e) => setAssetCue(a.id, e.target.value)}
                        className="w-full rounded-lg border border-border bg-transparent px-2.5 py-1.5 text-[12px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasVideo && (
            <div className="gen-suggestions">
              {QUICK_ACTIONS[lang].map((a) => (
                <button key={a.label} type="button" className="gen-chip" onClick={() => setText(a.text)}>
                  <Icon path={a.icon} size={12} /> {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Big rounded compose card — textarea up top, a toolbar row below it
              (attach + 剪辑方式 picker on the left, circular send button on the
              right) instead of the old single-line docked bar. */}
          <div className="px-4 pt-4 pb-2 sm:px-5">
            <div className="mx-auto max-w-[720px] rounded-2xl border border-border bg-card p-3 shadow-[0_3px_16px_-6px_rgba(15,27,60,0.12)]">
              <input ref={fileInputRef} type="file" multiple accept="video/*,image/*,audio/*" className="hidden" onChange={handleFileChosen} />
              <textarea
                value={text}
                rows={2}
                placeholder={assets.length > 0 ? t.editedPlaceholder : t.startPlaceholder}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="w-full resize-none bg-transparent px-1.5 pt-1 text-[14px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleAttachClick}
                    title={t.attachTitle}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Icon path={ICONS.plus} size={16} />
                  </button>
                  {hasVideo && (
                    <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setArm("arm_a")}
                        className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                          arm === "arm_a" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.applyTemplate}
                      </button>
                      <button
                        type="button"
                        onClick={() => setArm("arm_b")}
                        className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                          arm === "arm_b" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.aiWrite}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || (!text.trim() && assets.length === 0)}
                  aria-label={t.send}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform enabled:hover:-translate-y-px disabled:cursor-default disabled:opacity-40"
                >
                  {sending ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/40 border-t-background" />
                  ) : (
                    <Icon path={ICONS.arrowUp} size={16} />
                  )}
                </button>
              </div>
            </div>
          </div>

          <main className="dash-main">
            <div className="thread">
              {[...groupIntoTurns(messages)].reverse().map((turn) => (
                <div key={turn[0].id} className="flex flex-col gap-[18px]">
                  {turn.map((msg) => {
                    if (msg.role === "user") {
                      return (
                        <div key={msg.id} className="msg from-user">
                          <div className="bubble">
                            {msg.attachmentName && (
                              <div className="mb-1 flex items-center gap-1 text-xs opacity-75">
                                <Icon path={ICONS.attach} size={12} /> {msg.attachmentName}
                              </div>
                            )}
                            {msg.text || <span className="opacity-75">{t.noMessage}</span>}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id} className="msg from-bot">
                        <div className="bubble">
                          {msg.kind === "text" ? msg.text : <AgentJobBubble job={msg.job} onUpdate={(job) => updateJobMessage(msg.id, job)} lang={lang} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </main>
        </div>

        <RecentCreationsRail lang={lang} className="hidden w-72 lg:block" />
      </div>
    </div>
  );
}

// Placeholder shown the instant a job-creating request is sent, before the
// real job_id/status comes back — AgentJobBubble only reads .status here
// (an in-progress one, so it renders the spinner line) so the rest of the
// fields being empty is harmless; replaced by the real job within one round trip.
const PENDING_JOB: EditJob = {
  job_id: "", status: "RECEIVED", input_video_path: null, preview_path: null, final_path: null,
  planned_edit: null, error_message: null, current_stage: null, edit_request: "", degraded_operations: [],
  generation_cost_usd: 0, pipeline: "talking-head", created_at: null, updated_at: null,
};
